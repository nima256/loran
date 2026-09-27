import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError, type ApiErrorBody } from "./errors";
import { logger } from "./logger";
import { env } from "./env";

/**
 * Route-handler plumbing.
 *
 * Every `/api/v1/*` handler is wrapped by `handler()`, which is the single place
 * that turns a thrown error into the shared envelope. Handlers can therefore
 * just `throw notFound()` and trust the shape of what the client receives.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function fail(error: ApiErrorBody, status: number) {
  const response = NextResponse.json({ ok: false, error }, { status });
  if (error.retryAfter != null) response.headers.set("Retry-After", String(error.retryAfter));
  return response;
}

/** Zod issues → the `details` map forms render next to each field. */
function zodDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return new ApiError("validation_error", "اطلاعات ارسالی معتبر نیست.", {
      details: zodDetails(error),
      cause: error,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 unique violation, P2025 record-not-found — the only two that carry
    // a meaning the customer can act on. Everything else stays a server error
    // so no driver text or column name leaks.
    if (error.code === "P2002") {
      return new ApiError("conflict", "این مقدار قبلاً ثبت شده است.", { cause: error });
    }
    if (error.code === "P2025") {
      return new ApiError("not_found", undefined, { cause: error });
    }
  }

  return new ApiError("server_error", undefined, { cause: error });
}

export interface RequestContext {
  /**
   * The client address, or null when it cannot be established.
   *
   * Null is meaningful: callers must *skip* an IP-scoped rate limit rather than
   * fall back to a placeholder. Bucketing every unidentified client under one
   * key would turn a per-IP limit into a global one and let a single visitor
   * lock the whole site out of signing in.
   */
  ip: string | null;
  userAgent: string;
}

export function requestContext(request: Request): RequestContext {
  const headers = request.headers;
  // Forwarding headers are only trusted when the deployment says it sits behind
  // a proxy — otherwise a client could spoof its way past an IP rate limit.
  const forwarded = env.TRUST_PROXY
    ? headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")
    : null;
  return {
    ip: forwarded || null,
    userAgent: headers.get("user-agent")?.slice(0, 255) ?? "",
  };
}

type Handler<Ctx> = (request: Request, context: Ctx) => Promise<Response> | Response;

/**
 * Wraps a route handler with the shared error envelope and logging.
 *
 * Expected failures (`ApiError`) log at warn with no stack; anything else logs
 * at error with its cause and is reported to the client as a generic
 * `server_error`, so internals never travel over the wire.
 */
export function handler<Ctx = unknown>(fn: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      const apiError = toApiError(error);
      const meta = {
        method: request.method,
        url: new URL(request.url).pathname,
        code: apiError.code,
      };
      if (apiError.status >= 500) {
        logger.error(apiError.message, { ...meta, cause: apiError.cause ?? error });
      } else {
        logger.warn(apiError.message, meta);
      }
      return fail(apiError.toBody(), apiError.status);
    }
  };
}

/** Parses and validates a JSON body, throwing the shared validation error. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("validation_error", "بدنه درخواست باید JSON معتبر باشد.");
  }
  return schema.parse(raw);
}

/** Validates the query string of a request against a schema. */
export function readQuery<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) raw[key] = value;
  return schema.parse(raw);
}
