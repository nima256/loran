import "server-only";
import { prisma } from "./prisma";
import { rateLimited } from "./errors";

/**
 * Fixed-window rate limiting backed by PostgreSQL.
 *
 * The table, rather than process memory, is deliberate: Next.js may run several
 * server instances, and an in-memory counter would let an attacker spread OTP
 * requests across them. The write is a single upsert, so it stays cheap.
 */

export interface RateLimitRule {
  /** Distinct bucket name, e.g. "otp:request:phone". */
  name: string;
  /** How many requests the window allows. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export async function consumeRateLimit(
  rule: RateLimitRule,
  identifier: string
): Promise<RateLimitResult> {
  const key = `${rule.name}:${identifier}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + rule.windowSeconds * 1000);

  // Atomically: start a new window if none is live, otherwise increment.
  const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
    INSERT INTO rate_limits ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limits."expiresAt" <= ${now} THEN 1 ELSE rate_limits."count" + 1 END,
      "expiresAt" = CASE WHEN rate_limits."expiresAt" <= ${now} THEN ${expiresAt} ELSE rate_limits."expiresAt" END
    RETURNING "count", "expiresAt"
  `;

  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const windowEnd = row?.expiresAt ?? expiresAt;
  const retryAfter = Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000));

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfter,
  };
}

/**
 * Consumes a slot and throws the shared `rate_limited` error when exhausted.
 *
 * A null identifier is a no-op. That is the deliberate behaviour for IP-scoped
 * limits when the client address cannot be established (TRUST_PROXY off): the
 * alternative — bucketing every such client under one placeholder key — would
 * make one visitor able to rate-limit everyone else. The identity-scoped limit
 * that sits beside every IP limit is the one that actually protects the
 * resource.
 */
export async function enforceRateLimit(
  rule: RateLimitRule,
  identifier: string | null | undefined,
  message?: string
): Promise<void> {
  if (!identifier) return;
  const result = await consumeRateLimit(rule, identifier);
  if (!result.allowed) throw rateLimited(result.retryAfter, message);
}

/** Clears a bucket — called after a successful login so a legitimate user
 *  isn't punished for earlier typos. */
export async function resetRateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: `${rule.name}:${identifier}` } });
}

/** Deletes expired windows. Safe to call opportunistically. */
export async function pruneRateLimits(): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}

export const RATE_LIMITS = {
  /** Per phone number — the tighter of the two OTP limits. */
  otpRequestPhone: { name: "otp:request:phone", limit: 5, windowSeconds: 15 * 60 },
  /** Per IP, so one client cannot cycle through many numbers. */
  otpRequestIp: { name: "otp:request:ip", limit: 20, windowSeconds: 15 * 60 },
  otpVerifyPhone: { name: "otp:verify:phone", limit: 10, windowSeconds: 15 * 60 },
  adminLoginIp: { name: "admin:login:ip", limit: 10, windowSeconds: 15 * 60 },
  adminLoginEmail: { name: "admin:login:email", limit: 5, windowSeconds: 15 * 60 },
  checkoutCustomer: { name: "checkout:customer", limit: 20, windowSeconds: 10 * 60 },
  submissionIp: { name: "submission:ip", limit: 15, windowSeconds: 60 * 60 },
  reviewCustomer: { name: "review:customer", limit: 10, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;
