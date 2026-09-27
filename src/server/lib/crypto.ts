import "server-only";
import crypto from "node:crypto";
import { env } from "./env";

/**
 * Cryptographic primitives.
 *
 * Two things are never stored in the clear: OTP codes and session tokens.
 * Both are kept as a keyed HMAC-SHA256 so a database dump alone cannot be
 * replayed — an attacker would also need the server secret.
 */

function hmac(secret: string, value: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/** Keyed digest of an OTP code, scoped to the phone it was issued for. */
export function hashOtp(phone: string, code: string): string {
  return hmac(env.OTP_SECRET, `${phone}:${code}`);
}

/** A cryptographically secure five-digit code — `randomInt`, never `Math.random`. */
export function generateOtpCode(): string {
  return String(crypto.randomInt(10_000, 100_000));
}

/** The opaque value that goes in the session cookie. 256 bits of entropy. */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return hmac(env.SESSION_SECRET, token);
}

/** Constant-time comparison for anything secret-derived. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** A short, URL-safe random token — unsubscribe links, upload keys. */
export function randomToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Order numbers: «LRN-YYMMDD-XXXX» with a cryptographically random tail.
 * Generated server-side only; the browser never invents one.
 */
export function generateOrderNumber(prefix = "LRN"): string {
  const now = new Date();
  const stamp = [
    String(now.getUTCFullYear()).slice(2),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  const tail = String(crypto.randomInt(0, 10_000)).padStart(4, "0");
  return `${prefix}-${stamp}-${tail}`;
}
