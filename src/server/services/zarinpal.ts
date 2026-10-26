import "server-only";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { paymentError } from "../lib/errors";

/**
 * ZarinPal, over its documented HTTP API.
 *
 * The `zarinpal-checkout` package is unmaintained and speaks the retired
 * v1 (`PaymentRequest.json`) endpoints, so this talks to the current
 * `/pg/v4/payment/*` REST API directly. Behaviour matches what the reference
 * implementation did — request, redirect, verify — with the same amount-unit
 * handling.
 *
 * The Merchant ID is read from the environment and never leaves the server. It
 * is deliberately not exposed through the admin settings screen: a gateway
 * credential editable from a browser form is a credential that can be phished
 * out of one.
 */

const LIVE = {
  api: "https://api.zarinpal.com/pg/v4/payment",
  gateway: "https://www.zarinpal.com/pg/StartPay",
};
const SANDBOX = {
  api: "https://sandbox.zarinpal.com/pg/v4/payment",
  gateway: "https://sandbox.zarinpal.com/pg/StartPay",
};

const TIMEOUT_MS = 20_000;

function endpoints() {
  return env.ZARINPAL_SANDBOX ? SANDBOX : LIVE;
}

/**
 * Loran prices everything in Tomans. Always declare the matching v4 currency
 * explicitly (IRT or IRR) instead of relying on the gateway's default unit.
 * Verification sends the same numeric gateway amount used in the request.
 */
export function gatewayAmount(tomans: number): number {
  if (!Number.isSafeInteger(tomans) || tomans <= 0) {
    throw paymentError("مبلغ پرداخت معتبر نیست.");
  }
  const amount = env.ZARINPAL_AMOUNT_UNIT === "rial" ? tomans * 10 : tomans;
  if (!Number.isSafeInteger(amount)) throw paymentError("مبلغ پرداخت معتبر نیست.");
  return amount;
}

export function gatewayCurrency(): "IRT" | "IRR" {
  return env.ZARINPAL_AMOUNT_UNIT === "rial" ? "IRR" : "IRT";
}

export function callbackUrl(): string {
  return `${env.SITE_URL}/api/v1/payments/zarinpal/callback`;
}

/** Safe, bounded provider diagnostics; never log raw requests, account IDs or phones. */
function diagnostics(payload: unknown): {
  gatewayCode?: string; gatewayMessage?: string; gatewayFields?: string[];
} {
  if (!payload || typeof payload !== "object") return {};
  const response = payload as Record<string, unknown>;
  const errors = Array.isArray(response.errors) ? response.errors[0] : response.errors;
  const details = errors && typeof errors === "object" ? errors as Record<string, unknown> : {};
  const data = response.data && typeof response.data === "object"
    ? response.data as Record<string, unknown> : {};
  const code = details.code ?? data.code;
  const gatewayFields = Object.keys(details)
    .filter((key) => key !== "code" && key !== "message" && /^[a-z_]{1,40}$/i.test(key))
    .slice(0, 5);
  // Only short numeric error codes; do not accidentally log arbitrary payloads.
  const gatewayCode = (typeof code === "number" || typeof code === "string") &&
    /^-?\d{1,8}$/.test(String(code)) ? String(code) : undefined;
  const message = details.message ?? data.message;
  const gatewayMessage = typeof message === "string"
    ? message.slice(0, 160)
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
        .replace(/(?:\+98|0)9\d{9}/g, "[phone]")
        .replace(/(?:secret|token|key)\s*[:=]\s*\S+/gi, "[credential]")
    : undefined;
  return {
    gatewayCode, gatewayMessage,
    ...(gatewayFields.length ? { gatewayFields } : {}),
  };
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!env.ZARINPAL_MERCHANT_ID) {
    throw paymentError("درگاه پرداخت پیکربندی نشده است.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${endpoints().api}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ merchant_id: env.ZARINPAL_MERCHANT_ID, ...body }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      logger.error("پاسخ غیر JSON از زرین‌پال", { path, httpStatus: response.status });
      throw paymentError("پاسخ درگاه پرداخت قابل خواندن نبود.", {
        provider: "zarinpal", httpStatus: response.status,
      });
    }

    if (!response.ok) {
      const detail = diagnostics(payload);
      // 422 is typically rejected input or merchant configuration, NOT a
      // network outage. Report the provider's code in server logs for diagnosis.
      logger.error("زرین‌پال درخواست پرداخت را نپذیرفت", {
        path, httpStatus: response.status, ...detail,
        currency: gatewayCurrency(), sandbox: env.ZARINPAL_SANDBOX,
      });
      throw paymentError("درخواست پرداخت توسط زرین‌پال پذیرفته نشد.", {
        provider: "zarinpal", httpStatus: response.status, ...detail,
      });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "ApiError") throw error;
    const aborted = error instanceof DOMException && error.name === "AbortError";
    if (aborted) throw paymentError("مهلت ارتباط با درگاه پرداخت تمام شد.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Payment request                                                             */
/* -------------------------------------------------------------------------- */

interface RequestResponse {
  data?: { code?: number; authority?: string; message?: string };
  errors?: { code?: number; message?: string } | unknown[];
}

export interface PaymentRequestInput {
  /** In Tomans — converted here. */
  amount: number;
  description: string;
  mobile?: string;
  email?: string;
}

export interface PaymentRequestResult {
  authority: string;
  url: string;
}

export async function requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult> {
  const payload = await call<RequestResponse>("/request.json", {
    amount: gatewayAmount(input.amount),
    currency: gatewayCurrency(),
    callback_url: callbackUrl(),
    description: input.description.slice(0, 250),
    metadata: {
      ...(input.mobile ? { mobile: input.mobile } : {}),
      ...(input.email ? { email: input.email } : {}),
    },
  });

  // ZarinPal signals success with code 100.
  const authority = payload.data?.authority;
  if (payload.data?.code !== 100 || !authority) {
    logger.error("درخواست پرداخت زرین‌پال ناموفق بود", {
      ...diagnostics(payload), currency: gatewayCurrency(),
    });
    throw paymentError("ایجاد تراکنش در درگاه پرداخت انجام نشد.");
  }

  return { authority, url: `${endpoints().gateway}/${authority}` };
}

/* -------------------------------------------------------------------------- */
/* Verification                                                                */
/* -------------------------------------------------------------------------- */

interface VerifyResponse {
  data?: {
    code?: number;
    ref_id?: number | string;
    card_pan?: string;
    message?: string;
  };
  errors?: { code?: number; message?: string } | unknown[];
}

export interface VerifyResult {
  ok: boolean;
  /** True when the gateway says this authority was already verified (code 101). */
  alreadyVerified: boolean;
  refId: string;
  cardPan?: string;
  code?: number;
}

/**
 * Server-to-server verification.
 *
 * This — never the callback's query string — is what proves a payment. The
 * amount is sent again so the gateway confirms the charge matches the order the
 * server priced.
 *
 * Code 100 is a fresh success; 101 means "already verified", which is the
 * gateway's own idempotency signal and is treated as success so a repeated
 * callback resolves consistently.
 */
export async function verifyPayment(input: {
  authority: string;
  amount: number;
}): Promise<VerifyResult> {
  const payload = await call<VerifyResponse>("/verify.json", {
    amount: gatewayAmount(input.amount),
    authority: input.authority,
  });

  const code = payload.data?.code;
  const ok = code === 100 || code === 101;

  if (!ok) {
    logger.warn("تأیید پرداخت زرین‌پال ناموفق بود", { code, errors: payload.errors });
  }

  return {
    ok,
    alreadyVerified: code === 101,
    refId: String(payload.data?.ref_id ?? ""),
    cardPan: payload.data?.card_pan,
    code,
  };
}

/** True when the deployment is configured to skip the gateway (dev only). */
export function isMockMode(): boolean {
  return env.PAYMENT_MOCK;
}
