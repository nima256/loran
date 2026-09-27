import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { env } from "./env";
import { generateSessionToken, hashSessionToken } from "./crypto";
import { forbidden, unauthenticated } from "./errors";

/**
 * Session management for both audiences.
 *
 * Customers and administrators use separate cookies and separate tables, so an
 * admin session can never be mistaken for a customer one (or vice versa) by a
 * handler that forgets to check. Cookies are HttpOnly and SameSite, and the
 * token is only ever stored hashed — see `crypto.ts`.
 */

export const CUSTOMER_COOKIE = "loran_session";
export const ADMIN_COOKIE = "loran_admin_session";

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.COOKIE_SAMESITE,
    path: "/",
    maxAge: maxAgeSeconds,
  } as const;
}

export interface CustomerIdentity {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  sessionId: string;
}

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  sessionId: string;
}

/* -------------------------------------------------------------------------- */
/* Customer sessions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Issues a fresh customer session and sets the cookie.
 *
 * Any session the customer already held on this device is revoked first: the
 * session identifier must change at the moment of authentication so a token
 * captured before sign-in cannot be reused afterwards (session fixation).
 */
export async function createCustomerSession(
  customerId: string,
  meta: { ip?: string | null; userAgent?: string } = {}
): Promise<string> {
  const jar = await cookies();
  const previous = jar.get(CUSTOMER_COOKIE)?.value;
  if (previous) {
    await prisma.customerSession.updateMany({
      where: { tokenHash: hashSessionToken(previous), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const token = generateSessionToken();
  const maxAge = env.SESSION_TTL_DAYS * 24 * 60 * 60;
  await prisma.customerSession.create({
    data: {
      customerId,
      tokenHash: hashSessionToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });

  jar.set(CUSTOMER_COOKIE, token, cookieOptions(maxAge));
  return token;
}

/** Resolves the signed-in customer, or null. Never throws. */
export async function getCustomer(): Promise<CustomerIdentity | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { customer: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (session.customer.blocked) return null;

  return {
    id: session.customer.id,
    phone: session.customer.phone,
    firstName: session.customer.firstName,
    lastName: session.customer.lastName,
    email: session.customer.email,
    sessionId: session.id,
  };
}

/** Resolves the signed-in customer or throws `unauthenticated`. */
export async function requireCustomer(): Promise<CustomerIdentity> {
  const customer = await getCustomer();
  if (!customer) throw unauthenticated();
  return customer;
}

export async function destroyCustomerSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    await prisma.customerSession.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(CUSTOMER_COOKIE);
}

/** Revokes every session of a customer — "sign out everywhere". */
export async function revokeAllCustomerSessions(customerId: string): Promise<void> {
  await prisma.customerSession.updateMany({
    where: { customerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/* -------------------------------------------------------------------------- */
/* Admin sessions                                                              */
/* -------------------------------------------------------------------------- */

export async function createAdminSession(
  adminId: string,
  meta: { ip?: string | null; userAgent?: string } = {}
): Promise<string> {
  const jar = await cookies();
  const previous = jar.get(ADMIN_COOKIE)?.value;
  if (previous) {
    await prisma.adminSession.updateMany({
      where: { tokenHash: hashSessionToken(previous), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const token = generateSessionToken();
  const maxAge = env.ADMIN_SESSION_TTL_HOURS * 60 * 60;
  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: hashSessionToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });

  jar.set(ADMIN_COOKIE, token, cookieOptions(maxAge));
  return token;
}

export async function getAdmin(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (!session.admin.active) return null;

  return {
    id: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
    sessionId: session.id,
  };
}

/**
 * The server-side gate for every admin surface. Route handlers under
 * `/api/v1/admin/*` and every admin page call this — hiding UI is never the
 * control.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) throw unauthenticated("برای ورود به پنل مدیریت باید احراز هویت کنید.");
  return admin;
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(ADMIN_COOKIE);
}

/** Guards a resource that belongs to one customer. */
export function assertOwnership(ownerId: string | null, customerId: string): void {
  if (ownerId !== customerId) throw forbidden("این مورد متعلق به حساب شما نیست.");
}

/** Housekeeping for expired session rows. */
export async function pruneSessions(): Promise<void> {
  const now = new Date();
  await prisma.customerSession.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
}
