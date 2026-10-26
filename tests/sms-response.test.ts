import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/lib/env", () => ({
  env: {
    MELIPAYAMAK_SHARED_KEY: "fake-test-shared-key",
    MELIPAYAMAK_OTP_BODY_ID: "566864",
    MELIPAYAMAK_ORDER_BODY_ID: "566866",
    MELIPAYAMAK_ADMIN_ORDER_BODY_ID: "566868",
    MELIPAYAMAK_ORDER_ADMIN_MOBILES: "09014968828,09054243464",
    MELIPAYAMAK_SHIPPED_BODY_ID: "",
  },
}));
vi.mock("@/server/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { sendPatternSms, orderAdminRecipients } from "@/server/services/sms";
import { logger } from "@/server/lib/logger";

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("MeliPayamak shared SMS provider", () => {
  it("sends the configured OTP body ID and accepts a real recId", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recId: "3741437414", status: "" }), { status: 200 }));
    globalThis.fetch = mockedFetch as typeof fetch;
    const result = await sendPatternSms("otp", "09014968828", ["123456"]);
    expect(result.mocked).toBe(false);
    expect(result.accepted).toBe(true);
    const init = mockedFetch.mock.calls[0][1] as RequestInit;
    const requestBody = JSON.parse(init.body as string);
    expect(requestBody).toEqual({ bodyId: 566864, to: "09014968828", args: ["123456"] });
    expect(init.body).not.toContain("fake-test-shared-key");
  });

  it("rejects HTTP 200 with provider error status and reports a sanitized diagnosis", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "Body id not valid for OTP 123456" }), { status: 200 })
    ) as typeof fetch;
    await expect(sendPatternSms("otp", "09014968828", ["123456"]))
      .rejects.toThrow(/سامانه پیامک ارسال را تأیید نکرد/);
    const logText = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logText).toContain("Body id not valid");
    expect(logText).not.toContain("123456");
    expect(logText).not.toContain("fake-test-shared-key");
    expect(logText).toContain("566864");
  });

  it("does not falsely report success for an unconfirmed HTTP 200 without recId", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 })) as typeof fetch;
    await expect(sendPatternSms("otp", "09014968828", ["123456"])).rejects.toThrow(/تأیید نکرد/);
  });

  it("exposes safe diagnostic metadata for non-2xx replies", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "InvalidBodyId" }), { status: 400 })
    ) as typeof fetch;
    await expect(sendPatternSms("otp", "09014968828", ["123456"])).rejects.toThrow(/تأیید نکرد/);
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).toContain("InvalidBodyId");
  });

  it("keeps the customer/admin notification pattern arguments unchanged", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recId: "7654321" }), { status: 200 }));
    globalThis.fetch = mockedFetch as typeof fetch;
    await sendPatternSms("orderRegistered", "09121234567", ["مشتری", "LRN-261024-1111"]);
    await sendPatternSms("adminOrderRegistered", "09014968828", ["LRN-261024-1111"]);
    const customer = JSON.parse(mockedFetch.mock.calls[0][1].body as string);
    const admin = JSON.parse(mockedFetch.mock.calls[1][1].body as string);
    expect(customer).toMatchObject({ bodyId: 566866, args: ["مشتری", "LRN-261024-1111"] });
    expect(admin).toMatchObject({ bodyId: 566868, args: ["LRN-261024-1111"] });
    expect(orderAdminRecipients()).toEqual(["09014968828", "09054243464"]);
  });
});
