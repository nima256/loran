import type { ApiErrorBody, ApiErrorCode, ApiResponse } from "@/server/lib/errors";

/**
 * The browser's door to `/api/v1/*`.
 *
 * Every call returns either the unwrapped `data` or throws an `ApiClientError`
 * carrying the server's Persian message, so a component's catch block always
 * has something safe to show the customer.
 */

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;
  readonly retryAfter?: number;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = "ApiClientError";
    this.code = body.code;
    this.status = status;
    this.details = body.details;
    this.retryAfter = body.retryAfter;
  }

  /** First message for a given form field, ready to drop into an input. */
  fieldError(field: string): string | undefined {
    return this.details?.[field]?.[0];
  }
}

const NETWORK_MESSAGE = "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.";

export interface RequestOptions {
  signal?: AbortSignal;
  /** Sent as a JSON body. Omit for GET. */
  body?: unknown;
  headers?: Record<string, string>;
  /** FormData for uploads — sent as-is, with no Content-Type header. */
  formData?: FormData;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method,
    signal: options.signal,
    // Session cookies are HttpOnly; they ride along automatically but only if
    // the request is same-origin with credentials included.
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.formData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  };

  if (options.formData) init.body = options.formData;
  else if (options.body !== undefined) init.body = JSON.stringify(options.body);

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiClientError({ code: "server_error", message: NETWORK_MESSAGE }, 0);
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      { code: "server_error", message: "پاسخ سرور قابل خواندن نبود." },
      response.status
    );
  }

  if (!payload.ok) throw new ApiClientError(payload.error, response.status);
  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
  upload: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, formData }),
};

/** Builds a query string, dropping empty values. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

/** Safe Persian message for any thrown value, for toast/error rendering. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.";
}
