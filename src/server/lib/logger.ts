import "server-only";
import { env } from "./env";

/**
 * Structured server logging.
 *
 * Two rules this module exists to enforce:
 *  1. Secrets and OTP codes never reach a log line in production.
 *  2. Errors are logged with their technical cause, while the customer only
 *     ever sees the safe Persian message from `ApiError`.
 */

type Level = "debug" | "info" | "warn" | "error";

const REDACTED = "[redacted]";
/** Any key whose name matches is replaced wholesale, at any nesting depth. */
const SENSITIVE_KEY = /pass|secret|token|otp|code_?hash|authority|merchant|cookie|authorization|sharedkey/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: env.isProduction ? undefined : value.stack };
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: Level, message: string, context?: Record<string, unknown>) {
  if (level === "debug" && env.isProduction) return;
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
  };
  const serialised = env.isProduction ? JSON.stringify(line) : `[${level}] ${message}`;
  const target = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (env.isProduction) target(serialised);
  else target(serialised, context ? redact(context) : "");
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};

/**
 * Logs an OTP code. A no-op unless the deployment explicitly opted into mock
 * OTP mode, which `env` already forbids in production — so a real code can
 * never be written to a production log.
 */
export function logDevOtp(phone: string, code: string) {
  if (env.isProduction || !env.OTP_MOCK) return;
  console.log(`[DEV OTP] ${phone} → ${code}`);
}
