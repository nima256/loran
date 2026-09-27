import "server-only";
import { prisma, type Db } from "../lib/prisma";
import { logger } from "../lib/logger";
import type { AdminIdentity } from "../lib/session";

/**
 * Administrative audit trail.
 *
 * Every mutation an administrator performs is recorded with who did it, what
 * changed and a safe summary. There is a single administrator today, so this
 * stays deliberately simple — one append-only table, no permission graph.
 */

export type AuditAction =
  | "admin.login"
  | "admin.logout"
  | "product.create"
  | "product.update"
  | "product.archive"
  | "product.delete"
  | "variant.update"
  | "category.create"
  | "category.update"
  | "category.archive"
  | "category.delete"
  | "color.create"
  | "color.update"
  | "color.delete"
  | "size.create"
  | "size.update"
  | "size.delete"
  | "order.status"
  | "order.tracking"
  | "order.create_manual"
  | "order.note"
  | "coupon.create"
  | "coupon.update"
  | "coupon.archive"
  | "campaign.create"
  | "campaign.update"
  | "campaign.delete"
  | "customer.create"
  | "customer.update"
  | "review.moderate"
  | "return.decision"
  | "consultation.update"
  | "contact.update"
  | "shipping.update"
  | "payment_setting.update"
  | "media.upload";

export interface AuditInput {
  admin: AdminIdentity | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** One safe Persian sentence describing the change. No secrets. */
  summary: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Appends an audit entry. Never throws: a failure to log must not roll back the
 * mutation the administrator actually asked for.
 */
export async function recordAudit(input: AuditInput, db: Db = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        adminId: input.admin?.id ?? null,
        adminEmail: input.admin?.email ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 500),
        meta: (input.meta ?? undefined) as never,
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    logger.error("ثبت لاگ ممیزی انجام نشد", { action: input.action, cause: error });
  }
}

/**
 * Builds a compact diff of the fields that actually changed, for the audit
 * `meta`. Only the listed keys are considered, so nothing sensitive is swept in
 * by accident.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  keys: (keyof T)[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    if (!(key in after)) continue;
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[String(key)] = { from, to };
    }
  }
  return changes;
}
