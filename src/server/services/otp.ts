import "server-only";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { generateOtpCode, hashOtp, safeEqual } from "../lib/crypto";
import { ApiError, rateLimited } from "../lib/errors";
import { logDevOtp, logger } from "../lib/logger";
import { RATE_LIMITS, enforceRateLimit, resetRateLimit } from "../lib/rate-limit";
import { sendPatternSms } from "./sms";
import { toPersianDigits } from "@/lib/format";

/**
 * One-time login codes.
 *
 * Security posture, in one place so it can be audited at a glance:
 *  - The code is generated with `crypto.randomInt`, never `Math.random`.
 *  - Only an HMAC of `phone:code`, keyed by OTP_SECRET, is stored. The plain
 *    code exists in memory just long enough to hand to the SMS provider.
 *  - The HMAC is compared in constant time.
 *  - One live challenge per phone number; requesting a new code replaces it,
 *    so an old code stops working the moment a new one is sent.
 *  - A code is single-use: verification marks it consumed and deletes the row.
 *  - Attempts are capped, the window is short (~120s), resends have a cooldown,
 *    and both the phone number and the client IP are rate-limited.
 *  - The code is returned in the API response only under OTP_MOCK, which
 *    `env` refuses to accept in production.
 */

export interface IssueResult {
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Present only in explicitly configured mock mode. Never in production. */
  devCode?: string;
}

export interface IssueOptions {
  phone: string;
  ip: string | null;
}

export async function issueOtp({ phone, ip }: IssueOptions): Promise<IssueResult> {
  await enforceRateLimit(
    RATE_LIMITS.otpRequestPhone,
    phone,
    "درخواست کد برای این شماره بیش از حد مجاز بوده است. کمی بعد دوباره تلاش کنید."
  );
  await enforceRateLimit(RATE_LIMITS.otpRequestIp, ip);

  const existing = await prisma.otpChallenge.findUnique({
    where: { phone_purpose: { phone, purpose: "login" } },
  });

  // Resend cooldown — separate from the rate limit, and the reason a customer
  // sees a countdown rather than a lockout.
  if (existing) {
    const elapsed = Date.now() - existing.lastSentAt.getTime();
    const cooldown = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
    if (elapsed < cooldown) {
      const retryAfter = Math.ceil((cooldown - elapsed) / 1000);
      throw rateLimited(
        retryAfter,
        `ارسال مجدد کد تا ${toPersianDigits(retryAfter)} ثانیه دیگر امکان‌پذیر است.`
      );
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_SECONDS * 1000);
  const codeHash = hashOtp(phone, code);

  await prisma.otpChallenge.upsert({
    where: { phone_purpose: { phone, purpose: "login" } },
    create: { phone, purpose: "login", codeHash, expiresAt, lastSentAt: new Date() },
    // Replacing the hash invalidates any previously issued code, and the
    // attempt counter resets with it.
    update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date(), consumedAt: null },
  });

  if (env.OTP_MOCK) {
    logDevOtp(phone, code);
    return {
      expiresInSeconds: env.OTP_EXPIRES_SECONDS,
      resendAfterSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      devCode: code,
    };
  }

  try {
    const result = await sendPatternSms("otp", phone, [code]);
    if (result.mocked) {
      // No credentials configured but mock mode is off: the customer would
      // wait for a code that is never coming, so fail rather than pretend.
      throw new ApiError("sms_error", "سامانه پیامک پیکربندی نشده است.");
    }
  } catch (error) {
    // Don't leave a live challenge behind for a code nobody received.
    await prisma.otpChallenge
      .delete({ where: { phone_purpose: { phone, purpose: "login" } } })
      .catch(() => undefined);
    throw error;
  }

  return {
    expiresInSeconds: env.OTP_EXPIRES_SECONDS,
    resendAfterSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

/**
 * Verifies a code and consumes it.
 *
 * Throws on every failure path; returning normally means the phone number is
 * proven and the challenge is gone.
 */
export async function verifyOtp(phone: string, code: string): Promise<void> {
  await enforceRateLimit(RATE_LIMITS.otpVerifyPhone, phone);

  const challenge = await prisma.otpChallenge.findUnique({
    where: { phone_purpose: { phone, purpose: "login" } },
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) {
    if (challenge) {
      await prisma.otpChallenge
        .delete({ where: { id: challenge.id } })
        .catch(() => undefined);
    }
    throw new ApiError(
      "validation_error",
      "کد تأیید منقضی شده یا معتبر نیست. کد جدیدی دریافت کنید."
    );
  }

  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    throw rateLimited(
      env.OTP_RESEND_COOLDOWN_SECONDS,
      "تعداد تلاش مجاز تمام شد. لطفاً کد جدیدی دریافت کنید."
    );
  }

  if (!safeEqual(hashOtp(phone, code), challenge.codeHash)) {
    const updated = await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = Math.max(0, env.OTP_MAX_ATTEMPTS - updated.attempts);
    logger.warn("کد تأیید اشتباه وارد شد", { phone, remaining });
    throw new ApiError(
      "validation_error",
      remaining > 0
        ? `کد تأیید اشتباه است. ${toPersianDigits(remaining)} تلاش باقی مانده است.`
        : "تعداد تلاش مجاز تمام شد. لطفاً کد جدیدی دریافت کنید."
    );
  }

  // Single use: the row goes away, so the same code cannot be replayed even
  // within its remaining lifetime.
  await prisma.otpChallenge.delete({ where: { id: challenge.id } });
  await resetRateLimit(RATE_LIMITS.otpVerifyPhone, phone);
}

/** Housekeeping for expired challenges. */
export async function pruneOtpChallenges(): Promise<void> {
  await prisma.otpChallenge.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
