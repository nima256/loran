import "server-only";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { ApiError } from "../lib/errors";
import { normalizeIranMobile } from "@/lib/persian";

/**
 * MeliPayamak SMS provider.
 *
 * Loran only sends *pattern* (template) messages, never free text: the
 * provider holds the approved template and we supply its arguments. A template
 * is addressed by its `bodyId`, and the arguments fill the template's
 * placeholders in order.
 *
 *   POST https://console.melipayamak.com/api/send/shared/{sharedKey}
 *   { bodyId, to, args }
 *
 * Every message the app sends is declared in `TEMPLATES` below, so adding one
 * means adding a body id to the environment rather than composing text here.
 */

const ENDPOINT = "https://console.melipayamak.com/api/send/shared";
const TIMEOUT_MS = 10_000;

/** The transactional messages Loran sends, and the arguments each takes. */
export const TEMPLATES = {
  /** args: [code] */
  otp: () => env.MELIPAYAMAK_OTP_BODY_ID,
  /** args: [customerName, orderNumber] */
  orderRegistered: () => env.MELIPAYAMAK_ORDER_BODY_ID,
  /** args: [orderNumber, trackingCode] */
  orderShipped: () => env.MELIPAYAMAK_SHIPPED_BODY_ID,
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export interface SmsResult {
  /** True when nothing was actually sent — no credentials, or mock mode. */
  mocked: boolean;
  to: string;
  providerResponse?: string;
}

function assertRecipient(value: string): string {
  const mobile = normalizeIranMobile(value);
  if (!mobile) {
    throw new ApiError("validation_error", "شماره موبایل گیرنده پیامک معتبر نیست.");
  }
  return mobile;
}

/**
 * Sends one pattern message.
 *
 * When the provider isn't configured the call is a no-op that resolves
 * `mocked: true` rather than throwing, so local development and optional
 * notifications (order shipped, for instance) don't break a flow. The OTP
 * path is the exception and checks `mocked` itself — a login code that was
 * never sent must fail loudly.
 */
export async function sendPatternSms(
  template: TemplateName,
  to: string,
  args: (string | number)[]
): Promise<SmsResult> {
  const recipient = assertRecipient(to);
  const bodyId = TEMPLATES[template]();
  const normalizedArgs = args.map((value) => String(value ?? "").trim());

  if (!env.MELIPAYAMAK_SHARED_KEY || !bodyId) {
    logger.warn("پیامک ارسال نشد چون سامانه پیامک پیکربندی نشده است", { template, to: recipient });
    return { mocked: true, to: recipient };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${ENDPOINT}/${env.MELIPAYAMAK_SHARED_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ bodyId: Number(bodyId), to: recipient, args: normalizedArgs }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      // The provider's body can echo the arguments — which for an OTP is the
      // code — so it is logged but never surfaced to the caller.
      logger.error("سامانه پیامک خطا برگرداند", {
        template,
        to: recipient,
        status: response.status,
      });
      throw new ApiError("sms_error", "ارسال پیامک انجام نشد. کمی بعد دوباره تلاش کنید.", {
        cause: `melipayamak ${response.status}: ${text.slice(0, 200)}`,
      });
    }

    logger.info("پیامک ارسال شد", { template, to: recipient });
    return { mocked: false, to: recipient, providerResponse: text.slice(0, 500) };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError("sms_error", "ارسال پیامک انجام نشد. کمی بعد دوباره تلاش کنید.", {
      cause: aborted ? "melipayamak timeout" : error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sends a message without letting a provider failure break the caller's flow.
 * Used for notifications that are nice to have (order registered, shipped) but
 * must never roll back the order they describe.
 */
export async function sendPatternSmsQuietly(
  template: TemplateName,
  to: string,
  args: (string | number)[]
): Promise<SmsResult | null> {
  try {
    return await sendPatternSms(template, to, args);
  } catch (error) {
    logger.error("ارسال پیامک اطلاع‌رسانی ناموفق بود", { template, cause: error });
    return null;
  }
}
