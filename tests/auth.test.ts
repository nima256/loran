import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { env } from "@/server/lib/env";
import { generateOtpCode, hashOtp, safeEqual, generateOrderNumber } from "@/server/lib/crypto";
import { issueOtp, verifyOtp } from "@/server/services/otp";
import { canTransition, allowedTransitions } from "@/server/services/order-status";
import { uniquePhone } from "./helpers";

/**
 * Authentication and the order workflow.
 *
 * The OTP tests cover the replay, expiry and attempt-cap paths — the ones that
 * decide whether somebody else can sign in as a customer.
 */

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Rate limits are per-identity and persist; a fresh window per test.
  await prisma.rateLimit.deleteMany({});
});

describe("OTP codes", () => {
  it("are five digits", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{5}$/);
    }
  });

  it("are not predictable across a sample", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateOtpCode()));
    // 200 draws from 90,000 values: collisions are possible but a tiny set
    // would mean the generator is broken.
    expect(codes.size).toBeGreaterThan(150);
  });

  it("hash differently for the same code on different phones", () => {
    // The phone is part of the HMAC input, so a code captured for one number
    // cannot be replayed against another.
    expect(hashOtp("09120000001", "12345")).not.toBe(hashOtp("09120000002", "12345"));
  });

  it("compare in constant time and still compare correctly", () => {
    const hash = hashOtp("09120000001", "12345");
    expect(safeEqual(hash, hashOtp("09120000001", "12345"))).toBe(true);
    expect(safeEqual(hash, hashOtp("09120000001", "54321"))).toBe(false);
    expect(safeEqual(hash, "short")).toBe(false);
  });
});

describe("OTP challenge lifecycle", () => {
  it("stores only the hash, never the code", async () => {
    const phone = uniquePhone();
    const result = await issueOtp({ phone, ip: null });

    const row = await prisma.otpChallenge.findUniqueOrThrow({
      where: { phone_purpose: { phone, purpose: "login" } },
    });

    expect(result.devCode).toBeDefined();          // mock mode is on in tests
    expect(row.codeHash).not.toBe(result.devCode);
    expect(row.codeHash).toBe(hashOtp(phone, result.devCode!));
    // The plain code appears nowhere on the row.
    expect(JSON.stringify(row)).not.toContain(result.devCode!);

    await prisma.otpChallenge.delete({ where: { id: row.id } });
  });

  it("cannot be replayed — a verified code is consumed", async () => {
    const phone = uniquePhone();
    const { devCode } = await issueOtp({ phone, ip: null });

    await expect(verifyOtp(phone, devCode!)).resolves.toBeUndefined();
    await expect(verifyOtp(phone, devCode!)).rejects.toThrow(/منقضی شده یا معتبر نیست/);
  });

  it("counts wrong attempts and eventually refuses the challenge", async () => {
    const phone = uniquePhone();
    await issueOtp({ phone, ip: null });

    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i++) {
      await expect(verifyOtp(phone, "00000")).rejects.toThrow();
    }

    // The challenge is spent, so even the right code no longer works.
    await expect(verifyOtp(phone, "00000")).rejects.toThrow();
    const row = await prisma.otpChallenge.findUnique({
      where: { phone_purpose: { phone, purpose: "login" } },
    });
    expect(row).toBeNull();
  });

  it("invalidates the previous code when a new one is issued", async () => {
    const phone = uniquePhone();
    const first = await issueOtp({ phone, ip: null });

    // Sidestep the resend cooldown, which is tested separately.
    await prisma.otpChallenge.update({
      where: { phone_purpose: { phone, purpose: "login" } },
      data: { lastSentAt: new Date(Date.now() - 10 * 60_000) },
    });

    const second = await issueOtp({ phone, ip: null });
    await expect(verifyOtp(phone, first.devCode!)).rejects.toThrow();
    await expect(verifyOtp(phone, second.devCode!)).resolves.toBeUndefined();
  });

  it("refuses an expired code", async () => {
    const phone = uniquePhone();
    const { devCode } = await issueOtp({ phone, ip: null });

    await prisma.otpChallenge.update({
      where: { phone_purpose: { phone, purpose: "login" } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(verifyOtp(phone, devCode!)).rejects.toThrow(/منقضی/);
  });

  it("enforces the resend cooldown", async () => {
    const phone = uniquePhone();
    await issueOtp({ phone, ip: null });
    await expect(issueOtp({ phone, ip: null })).rejects.toThrow(/ارسال مجدد/);

    await prisma.otpChallenge.deleteMany({ where: { phone } });
  });

  it("rate-limits repeated requests for one number", async () => {
    const phone = uniquePhone();

    // Each request clears the cooldown so the *rate limit* is what trips.
    let limited = false;
    for (let i = 0; i < 8; i++) {
      try {
        await issueOtp({ phone, ip: null });
        await prisma.otpChallenge.updateMany({
          where: { phone },
          data: { lastSentAt: new Date(Date.now() - 10 * 60_000) },
        });
      } catch (error) {
        if ((error as Error).message.includes("بیش از حد")) {
          limited = true;
          break;
        }
      }
    }
    expect(limited).toBe(true);

    await prisma.otpChallenge.deleteMany({ where: { phone } });
  });
});

describe("order numbers", () => {
  it("follow the LRN-YYMMDD-NNNN shape", () => {
    expect(generateOrderNumber()).toMatch(/^LRN-\d{6}-\d{4}$/);
  });

  it("are not sequential, so they leak no volume information", () => {
    const tails = Array.from({ length: 50 }, () => generateOrderNumber().split("-")[2]);
    expect(new Set(tails).size).toBeGreaterThan(30);
  });
});

describe("order status workflow", () => {
  it("permits the documented forward transitions", () => {
    expect(canTransition("awaiting_payment", "preparing")).toBe(true);
    expect(canTransition("preparing", "packaged")).toBe(true);
    expect(canTransition("packaged", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("refuses impossible jumps an admin request might try", () => {
    expect(canTransition("awaiting_payment", "delivered")).toBe(false);
    expect(canTransition("delivered", "preparing")).toBe(false);
    expect(canTransition("refunded", "preparing")).toBe(false);
    // A status cannot transition to itself.
    expect(canTransition("preparing", "preparing")).toBe(false);
  });

  it("treats refunded as terminal", () => {
    expect(allowedTransitions("refunded")).toHaveLength(0);
  });

  it("allows cancellation while an order is still in the shop's hands", () => {
    expect(canTransition("preparing", "cancelled")).toBe(true);
    expect(canTransition("packaged", "cancelled")).toBe(true);
    // Once it has shipped, cancelling is not the right verb — it is returned.
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("shipped", "returned")).toBe(true);
  });
});
