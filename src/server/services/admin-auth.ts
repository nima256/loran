import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/errors";
import { logger } from "../lib/logger";
import { RATE_LIMITS, enforceRateLimit, resetRateLimit } from "../lib/rate-limit";
import { createAdminSession } from "../lib/session";
import { recordAudit } from "./audit";

/**
 * Single-administrator authentication.
 *
 * Loran needs one administrator, so this is deliberately a plain email +
 * password login rather than a staff/permission system. The password is stored
 * as an Argon2id hash and never in plaintext; the administrator is created (or
 * has their password rotated) by the seed from ADMIN_EMAIL/ADMIN_PASSWORD.
 */

/** Argon2id parameters — OWASP's second recommended option (19 MiB, t=2). */
const ARGON_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS);
}

export interface LoginInput {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string;
}

export async function loginAdmin({ email, password, ip, userAgent }: LoginInput) {
  await enforceRateLimit(RATE_LIMITS.adminLoginIp, ip);
  await enforceRateLimit(RATE_LIMITS.adminLoginEmail, email);

  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // The same message and roughly the same work for both "no such account" and
  // "wrong password", so the response cannot be used to enumerate accounts.
  const invalid = () =>
    new ApiError("unauthenticated", "ایمیل یا رمز عبور اشتباه است.");

  if (!admin || !admin.active) {
    // Spend comparable time so a missing account isn't distinguishable by timing.
    await verify(
      "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$J4moa2MFTBAMfLAlY1XtaGyeaCpUdMcVioFYD5pjvv0",
      password,
      ARGON_OPTIONS
    ).catch(() => false);
    logger.warn("ورود ناموفق به پنل مدیریت", { email, reason: "unknown-account" });
    throw invalid();
  }

  let valid = false;
  try {
    valid = await verify(admin.passwordHash, password, ARGON_OPTIONS);
  } catch (error) {
    logger.error("بررسی رمز عبور مدیر با خطا مواجه شد", { cause: error });
  }

  if (!valid) {
    logger.warn("ورود ناموفق به پنل مدیریت", { email, reason: "bad-password" });
    throw invalid();
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  await createAdminSession(admin.id, { ip, userAgent });
  await resetRateLimit(RATE_LIMITS.adminLoginEmail, email);

  const identity = { id: admin.id, email: admin.email, name: admin.name, sessionId: "" };
  await recordAudit({
    admin: identity,
    action: "admin.login",
    entityType: "admin",
    entityId: admin.id,
    summary: `ورود مدیر ${admin.email} به پنل`,
    ip,
  });

  return { id: admin.id, email: admin.email, name: admin.name };
}

/** Changes the administrator's password, verifying the current one first. */
export async function changeAdminPassword(
  adminId: string,
  currentPassword: string,
  nextPassword: string
): Promise<void> {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw new ApiError("not_found", "حساب مدیر پیدا نشد.");

  const valid = await verify(admin.passwordHash, currentPassword, ARGON_OPTIONS).catch(() => false);
  if (!valid) throw new ApiError("unauthenticated", "رمز عبور فعلی اشتباه است.");

  await prisma.adminUser.update({
    where: { id: adminId },
    data: { passwordHash: await hashPassword(nextPassword) },
  });

  // Every other session of this administrator is dropped, so a stolen cookie
  // stops working the moment the password changes.
  await prisma.adminSession.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
