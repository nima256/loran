/**
 * The one error vocabulary the whole API speaks.
 *
 * Every route handler returns the same envelope, so the client never has to
 * guess at a shape:
 *
 *   success → { ok: true,  data: … }
 *   failure → { ok: false, error: { code, message, details? } }
 *
 * `message` is always a safe Persian sentence meant for the customer. Technical
 * detail (stack, SQL, driver text) is logged server-side and never serialised.
 *
 * This module is intentionally free of `server-only` so the client can import
 * the `ApiErrorCode` union and the response types for type-safe fetching.
 */

export const API_ERROR_CODES = [
  "validation_error",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "out_of_stock",
  "coupon_invalid",
  "payment_error",
  "rate_limited",
  "sms_error",
  "server_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** HTTP status each code maps to. Kept here so routes never pick one by hand. */
export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  out_of_stock: 409,
  coupon_invalid: 422,
  payment_error: 502,
  rate_limited: 429,
  sms_error: 502,
  server_error: 500,
};

/** Fallback Persian copy, used when a throw site doesn't supply its own. */
export const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  validation_error: "اطلاعات ارسالی معتبر نیست.",
  unauthenticated: "برای ادامه باید وارد حساب کاربری خود شوید.",
  forbidden: "به این بخش دسترسی ندارید.",
  not_found: "موردی که دنبال آن بودید پیدا نشد.",
  conflict: "این عملیات با وضعیت فعلی سازگار نیست.",
  out_of_stock: "موجودی کافی نیست.",
  coupon_invalid: "کد تخفیف معتبر نیست.",
  payment_error: "ارتباط با درگاه پرداخت برقرار نشد.",
  rate_limited: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
  sms_error: "ارسال پیامک انجام نشد. کمی بعد دوباره تلاش کنید.",
  server_error: "خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.",
};

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  /** Field-level messages for forms: { phone: "شماره معتبر نیست" }. */
  details?: Record<string, string[]>;
  /** Seconds until the caller may retry — set on `rate_limited`. */
  retryAfter?: number;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

/**
 * The only error type route handlers should throw on purpose. Anything else
 * reaching the handler wrapper is treated as an unexpected `server_error`.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  readonly retryAfter?: number;
  /** Logged, never sent: the technical reason behind the safe message. */
  readonly cause?: unknown;

  constructor(
    code: ApiErrorCode,
    message?: string,
    options: { details?: Record<string, string[]>; retryAfter?: number; cause?: unknown } = {}
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = options.details;
    this.retryAfter = options.retryAfter;
    this.cause = options.cause;
  }

  toBody(): ApiErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
      ...(this.retryAfter != null ? { retryAfter: this.retryAfter } : {}),
    };
  }
}

/* Shorthand constructors — these read better at the throw site. */
export const badRequest = (message?: string, details?: Record<string, string[]>) =>
  new ApiError("validation_error", message, { details });
export const unauthenticated = (message?: string) => new ApiError("unauthenticated", message);
export const forbidden = (message?: string) => new ApiError("forbidden", message);
export const notFound = (message?: string) => new ApiError("not_found", message);
export const conflict = (message?: string) => new ApiError("conflict", message);
export const outOfStock = (message?: string) => new ApiError("out_of_stock", message);
export const couponInvalid = (message?: string) => new ApiError("coupon_invalid", message);
export const paymentError = (message?: string, cause?: unknown) =>
  new ApiError("payment_error", message, { cause });
export const rateLimited = (retryAfter: number, message?: string) =>
  new ApiError("rate_limited", message, { retryAfter });
