import "server-only";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { env } from "../lib/env";
import { slugify } from "@/lib/persian";

/**
 * Store settings an administrator may safely change from a browser.
 *
 * The boundary that matters: **business settings are editable, credentials are
 * not.** The ZarinPal Merchant ID lives in the server environment and is never
 * read into, rendered by, or writable from this screen. A gateway credential
 * that can be edited through an admin form is a credential that can be phished
 * out of one — and it would also mean the secret travelled to a browser.
 */

/* -------------------------------------------------------------------------- */
/* Shipping methods                                                            */
/* -------------------------------------------------------------------------- */

export interface ShippingMethodInput {
  code?: string;
  name: string;
  description?: string;
  cost: number;
  paidOnDelivery: boolean;
  estimate?: string;
  active?: boolean;
  position?: number;
  freeShippingThreshold?: number | null;
  supportsTracking?: boolean;
}

export async function listShippingMethodsForAdmin() {
  const rows = await prisma.shippingMethod.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { orders: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    cost: row.cost,
    paidOnDelivery: row.paidOnDelivery,
    estimate: row.estimate,
    active: row.active,
    position: row.position,
    freeShippingThreshold: row.freeShippingThreshold,
    supportsTracking: row.supportsTracking,
    orderCount: row._count.orders,
  }));
}

export async function createShippingMethod(input: ShippingMethodInput) {
  const code = input.code?.trim().toLowerCase() || slugify(input.name);
  if (!code) throw badRequest("شناسه روش ارسال را وارد کنید.");

  const clash = await prisma.shippingMethod.findUnique({ where: { code } });
  if (clash) throw conflict("روش ارسالی با این شناسه از قبل وجود دارد.");
  if (input.cost < 0) throw badRequest("هزینه ارسال نمی‌تواند منفی باشد.");

  const last = await prisma.shippingMethod.findFirst({ orderBy: { position: "desc" } });
  return prisma.shippingMethod.create({
    data: {
      code,
      name: input.name,
      description: input.description ?? "",
      cost: input.cost,
      paidOnDelivery: input.paidOnDelivery,
      estimate: input.estimate ?? "",
      active: input.active ?? true,
      position: input.position ?? (last ? last.position + 1 : 0),
      freeShippingThreshold: input.freeShippingThreshold ?? null,
      supportsTracking: input.supportsTracking ?? true,
    },
  });
}

export async function updateShippingMethod(id: string, input: Partial<ShippingMethodInput>) {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw notFound("روش ارسال پیدا نشد.");
  if (input.cost != null && input.cost < 0) throw badRequest("هزینه ارسال نمی‌تواند منفی باشد.");

  // The code is the stable key orders snapshot; renaming it would orphan them.
  return prisma.shippingMethod.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.cost !== undefined ? { cost: input.cost } : {}),
      ...(input.paidOnDelivery !== undefined ? { paidOnDelivery: input.paidOnDelivery } : {}),
      ...(input.estimate !== undefined ? { estimate: input.estimate } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.freeShippingThreshold !== undefined
        ? { freeShippingThreshold: input.freeShippingThreshold }
        : {}),
      ...(input.supportsTracking !== undefined
        ? { supportsTracking: input.supportsTracking }
        : {}),
    },
  });
}

export async function deleteShippingMethod(id: string) {
  const method = await prisma.shippingMethod.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!method) throw notFound("روش ارسال پیدا نشد.");

  if (method._count.orders > 0) {
    await prisma.shippingMethod.update({ where: { id }, data: { active: false } });
    return {
      action: "deactivated" as const,
      message: `«${method.name}» در سفارش‌های ثبت‌شده استفاده شده، بنابراین غیرفعال شد.`,
    };
  }

  await prisma.shippingMethod.delete({ where: { id } });
  return { action: "deleted" as const, message: `روش ارسال «${method.name}» حذف شد.` };
}

/* -------------------------------------------------------------------------- */
/* Payment methods                                                             */
/* -------------------------------------------------------------------------- */

export interface PaymentSettingView {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  position: number;
  /**
   * Whether the gateway's server-side credentials are present. A boolean, not
   * the value — the admin needs to know it is configured, never what it is.
   */
  credentialsConfigured: boolean;
  /** Where the operator changes those credentials, since it is not here. */
  credentialsHint: string;
  sandbox: boolean;
}

export async function listPaymentSettings(): Promise<PaymentSettingView[]> {
  const rows = await prisma.paymentMethodSetting.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active,
    position: row.position,
    credentialsConfigured:
      row.code === "zarinpal" ? Boolean(env.ZARINPAL_MERCHANT_ID) || env.PAYMENT_MOCK : true,
    credentialsHint:
      row.code === "zarinpal"
        ? "مرچنت‌آیدی زرین‌پال یک کلید محرمانه سرور است و از طریق متغیر محیطی ZARINPAL_MERCHANT_ID تنظیم می‌شود، نه از این صفحه."
        : "",
    sandbox: row.code === "zarinpal" ? env.ZARINPAL_SANDBOX : false,
  }));
}

/**
 * Updates the non-secret settings of a payment method.
 *
 * The accepted fields are enumerated rather than spread, so no future change to
 * the form can smuggle a credential into the database.
 */
export async function updatePaymentSetting(
  id: string,
  input: { name?: string; description?: string; active?: boolean; position?: number }
) {
  const existing = await prisma.paymentMethodSetting.findUnique({ where: { id } });
  if (!existing) throw notFound("روش پرداخت پیدا نشد.");

  if (input.active === false) {
    const others = await prisma.paymentMethodSetting.count({
      where: { active: true, id: { not: id } },
    });
    if (others === 0) {
      throw badRequest("حداقل یک روش پرداخت باید فعال بماند، وگرنه ثبت سفارش ممکن نیست.");
    }
  }

  return prisma.paymentMethodSetting.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                   */
/* -------------------------------------------------------------------------- */

export async function listAuditLog(options: { page: number; pageSize: number; action?: string }) {
  const where = options.action ? { action: options.action } : {};
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId ?? undefined,
      summary: row.summary,
      adminEmail: row.adminEmail ?? undefined,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}
