import "server-only";
import { Prisma, type RequestStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { conflict, notFound } from "../lib/errors";
import { randomToken } from "../lib/crypto";
import { paginated, paginationArgs, type Pagination } from "../lib/validation";
import { logger } from "../lib/logger";

/**
 * Storefront form submissions: size consultations, contact messages and
 * newsletter sign-ups.
 *
 * These all used to report success from a `setTimeout`. They now persist, and
 * each has an administrator-facing queue with a status the store can actually
 * work through.
 */

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "جدید",
  in_progress: "در حال بررسی",
  contacted: "تماس گرفته شد",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
};

/** Requests move forward, or are cancelled; they never jump backwards to `new`. */
const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  new: ["in_progress", "contacted", "completed", "cancelled"],
  in_progress: ["contacted", "completed", "cancelled"],
  contacted: ["in_progress", "completed", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["new", "in_progress"],
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return from !== to && (REQUEST_TRANSITIONS[from]?.includes(to) ?? false);
}

function reference(prefix: string): string {
  return `${prefix}-${randomToken(4).toUpperCase().slice(0, 6)}`;
}

/* -------------------------------------------------------------------------- */
/* Consultations                                                               */
/* -------------------------------------------------------------------------- */

export interface ConsultationInput {
  fullName: string;
  phone: string;
  /** The form's structured answers, stored exactly as submitted. */
  answers: Record<string, unknown>;
  message?: string;
  customerId?: string | null;
}

export async function createConsultation(input: ConsultationInput) {
  const row = await prisma.consultationRequest.create({
    data: {
      number: reference("CNS"),
      customerId: input.customerId ?? null,
      fullName: input.fullName,
      phone: input.phone,
      answers: input.answers as Prisma.InputJsonValue,
      message: input.message ?? null,
    },
    select: { id: true, number: true },
  });
  logger.info("درخواست مشاوره ثبت شد", { number: row.number });
  return row;
}

export interface AdminRequestFilters extends Pagination {
  q?: string;
  status?: RequestStatus;
}

export async function listConsultations(filters: AdminRequestFilters) {
  const where: Prisma.ConsultationRequestWhereInput = {};
  if (filters.status) where.status = filters.status;
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.consultationRequest.count({ where }),
    prisma.consultationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(filters),
    }),
  ]);

  return paginated(
    rows.map((row) => ({
      id: row.id,
      number: row.number,
      fullName: row.fullName,
      phone: row.phone,
      status: row.status,
      statusLabel: REQUEST_STATUS_LABELS[row.status],
      answers: row.answers as Record<string, unknown>,
      message: row.message ?? undefined,
      adminNote: row.adminNote ?? undefined,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    filters
  );
}

export async function updateConsultation(
  id: string,
  input: { status?: RequestStatus; adminNote?: string }
) {
  const row = await prisma.consultationRequest.findUnique({ where: { id } });
  if (!row) throw notFound("درخواست مشاوره پیدا نشد.");
  if (input.status && !canTransitionRequest(row.status, input.status)) {
    throw conflict("تغییر وضعیت درخواست مجاز نیست.");
  }
  return prisma.consultationRequest.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
    },
    select: { id: true, number: true, status: true },
  });
}

/* -------------------------------------------------------------------------- */
/* Contact messages                                                            */
/* -------------------------------------------------------------------------- */

export interface ContactInput {
  fullName: string;
  phone?: string;
  email?: string;
  subject: string;
  message: string;
}

export async function createContactMessage(input: ContactInput) {
  const row = await prisma.contactMessage.create({
    data: {
      number: reference("MSG"),
      fullName: input.fullName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      subject: input.subject,
      message: input.message,
    },
    select: { id: true, number: true },
  });
  logger.info("پیام تماس با ما ثبت شد", { number: row.number });
  return row;
}

export async function listContactMessages(filters: AdminRequestFilters) {
  const where: Prisma.ContactMessageWhereInput = {};
  if (filters.status) where.status = filters.status;
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(filters),
    }),
  ]);

  return paginated(
    rows.map((row) => ({
      id: row.id,
      number: row.number,
      fullName: row.fullName,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      subject: row.subject,
      message: row.message,
      status: row.status,
      statusLabel: REQUEST_STATUS_LABELS[row.status],
      adminNote: row.adminNote ?? undefined,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    filters
  );
}

export async function updateContactMessage(
  id: string,
  input: { status?: RequestStatus; adminNote?: string }
) {
  const row = await prisma.contactMessage.findUnique({ where: { id } });
  if (!row) throw notFound("پیام پیدا نشد.");
  if (input.status && !canTransitionRequest(row.status, input.status)) {
    throw conflict("تغییر وضعیت پیام مجاز نیست.");
  }
  return prisma.contactMessage.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
    },
    select: { id: true, number: true, status: true },
  });
}

/* -------------------------------------------------------------------------- */
/* Newsletter                                                                  */
/* -------------------------------------------------------------------------- */

export interface SubscribeResult {
  /** False when the address was already subscribed. */
  created: boolean;
  /** True when a previously unsubscribed address was reactivated. */
  resubscribed: boolean;
}

/**
 * Subscribes an address.
 *
 * Re-subscribing an existing address is a success, not a conflict — telling a
 * visitor "you are already on the list" is fine, but an error page for typing
 * their address twice is not. A previously unsubscribed address is reactivated.
 */
export async function subscribeNewsletter(
  email: string,
  source?: string
): Promise<SubscribeResult> {
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

  if (existing) {
    if (existing.active) return { created: false, resubscribed: false };
    await prisma.newsletterSubscriber.update({
      where: { email },
      data: { active: true, unsubscribedAt: null },
    });
    return { created: false, resubscribed: true };
  }

  await prisma.newsletterSubscriber.create({
    data: { email, unsubscribeToken: randomToken(24), source: source ?? null },
  });
  return { created: true, resubscribed: false };
}

/**
 * One-click unsubscribe.
 *
 * Keyed by an unguessable token rather than the address, so a link cannot be
 * used to unsubscribe somebody else by editing an email address in the URL.
 */
export async function unsubscribeNewsletter(token: string): Promise<boolean> {
  const result = await prisma.newsletterSubscriber.updateMany({
    where: { unsubscribeToken: token, active: true },
    data: { active: false, unsubscribedAt: new Date() },
  });
  return result.count > 0;
}

export async function listNewsletterSubscribers(filters: Pagination & { q?: string }) {
  const where: Prisma.NewsletterSubscriberWhereInput = {};
  const q = filters.q?.trim();
  if (q) where.email = { contains: q, mode: "insensitive" };

  const [total, rows] = await Promise.all([
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(filters),
    }),
  ]);

  return paginated(
    rows.map((row) => ({
      id: row.id,
      email: row.email,
      active: row.active,
      source: row.source ?? undefined,
      createdAt: row.createdAt.toISOString(),
      unsubscribedAt: row.unsubscribedAt?.toISOString(),
    })),
    total,
    filters
  );
}
