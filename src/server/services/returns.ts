import "server-only";
// Aliased: Prisma's `ReturnType` enum would otherwise shadow the built-in
// TypeScript utility type of the same name.
import { Prisma, type ReturnStatus, type ReturnType as ReturnKind } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { paginated, paginationArgs, type Pagination } from "../lib/validation";
import { randomToken } from "../lib/crypto";
import { restoreStock } from "./orders";
import { siteConfig } from "@/lib/site-config";

/**
 * Return and exchange requests.
 *
 * Status workflow — an administrator cannot skip to an arbitrary state:
 *
 *   requested ──┬─→ info_requested ─→ requested
 *               ├─→ approved ─→ in_transit ─→ received ─→ completed
 *               │                                      └─→ refunded
 *               ├─→ rejected
 *               └─→ cancelled            (customer withdraws)
 *
 * Stock is returned to the shelf when a request reaches `received`, because
 * that is the point at which the goods are physically back — not when the
 * request is merely approved.
 */

const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["info_requested", "approved", "rejected", "cancelled"],
  info_requested: ["requested", "approved", "rejected", "cancelled"],
  approved: ["in_transit", "received", "rejected", "cancelled"],
  in_transit: ["received", "cancelled"],
  received: ["completed", "refunded"],
  completed: ["refunded"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

export function canTransitionReturn(from: ReturnStatus, to: ReturnStatus): boolean {
  return from !== to && (TRANSITIONS[from]?.includes(to) ?? false);
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "ثبت شده",
  info_requested: "در انتظار اطلاعات تکمیلی",
  approved: "تأیید شده",
  rejected: "رد شده",
  in_transit: "در مسیر بازگشت",
  received: "دریافت شد",
  completed: "تکمیل شده",
  refunded: "بازپرداخت شد",
  cancelled: "لغو شده",
};

export const RETURN_REASONS = [
  "سایز مناسب نبود",
  "رنگ یا مدل با تصویر تفاوت داشت",
  "کالا ایراد یا نقص داشت",
  "کالای اشتباه ارسال شد",
  "نظرم عوض شد",
  "دلیل دیگر",
] as const;

/* -------------------------------------------------------------------------- */
/* Eligibility                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Orders a customer may open a request against.
 *
 * Only delivered orders inside the return window qualify, and an item already
 * covered by an open request is excluded so it cannot be claimed twice.
 */
export async function listReturnableOrders(customerId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - siteConfig.commerce.returnWindowDays);

  const orders = await prisma.order.findMany({
    where: {
      customerId,
      status: "delivered",
      deliveredAt: { gte: cutoff },
    },
    include: {
      items: {
        include: {
          returnItems: {
            where: {
              request: { status: { notIn: ["rejected", "cancelled"] } },
            },
            select: { quantity: true },
          },
        },
      },
    },
    orderBy: { deliveredAt: "desc" },
  });

  return orders
    .map((order) => ({
      id: order.id,
      number: order.number,
      createdAt: order.createdAt.toISOString(),
      deliveredAt: order.deliveredAt?.toISOString(),
      items: order.items
        .map((item) => {
          const claimed = item.returnItems.reduce((n, r) => n + r.quantity, 0);
          return {
            id: item.id,
            name: item.name,
            image: item.image,
            colorName: item.colorName,
            size: item.size,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            /** How many of this line are still eligible. */
            available: Math.max(0, item.quantity - claimed),
          };
        })
        .filter((item) => item.available > 0),
    }))
    .filter((order) => order.items.length > 0);
}

/* -------------------------------------------------------------------------- */
/* Creation                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateReturnInput {
  customerId: string;
  orderId: string;
  type: ReturnKind;
  reason: string;
  customerNote?: string;
  items: { orderItemId: string; quantity: number }[];
}

export async function createReturnRequest(input: CreateReturnInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, customerId: input.customerId },
      include: {
        items: {
          include: {
            returnItems: {
              where: { request: { status: { notIn: ["rejected", "cancelled"] } } },
              select: { quantity: true },
            },
          },
        },
      },
    });
    if (!order) throw notFound("سفارش پیدا نشد.");

    if (order.status !== "delivered") {
      throw badRequest("فقط برای سفارش‌های تحویل‌شده می‌توانید درخواست مرجوعی ثبت کنید.");
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - siteConfig.commerce.returnWindowDays);
    if (!order.deliveredAt || order.deliveredAt < cutoff) {
      throw badRequest(
        `مهلت ${siteConfig.commerce.returnWindowDays} روزه مرجوعی این سفارش به پایان رسیده است.`
      );
    }

    const byId = new Map(order.items.map((i) => [i.id, i]));
    const lines: { orderItemId: string; quantity: number; name: string; colorName: string; size: number; unitPrice: number }[] = [];
    let refundAmount = 0;

    for (const requested of input.items) {
      const item = byId.get(requested.orderItemId);
      if (!item) throw badRequest("یکی از کالاهای انتخاب‌شده در این سفارش نیست.");

      const claimed = item.returnItems.reduce((n, r) => n + r.quantity, 0);
      const available = item.quantity - claimed;
      if (requested.quantity > available) {
        throw conflict(
          available > 0
            ? `برای «${item.name}» حداکثر ${available} عدد قابل مرجوع است.`
            : `برای «${item.name}» قبلاً درخواست مرجوعی ثبت شده است.`
        );
      }

      refundAmount += item.unitPrice * requested.quantity;
      lines.push({
        orderItemId: item.id,
        quantity: requested.quantity,
        name: item.name,
        colorName: item.colorName,
        size: item.size,
        unitPrice: item.unitPrice,
      });
    }

    if (!lines.length) throw badRequest("حداقل یک کالا را برای مرجوعی انتخاب کنید.");

    const request = await tx.returnRequest.create({
      data: {
        number: `RMA-${randomToken(4).toUpperCase().slice(0, 6)}`,
        orderId: order.id,
        customerId: input.customerId,
        type: input.type,
        status: "requested",
        reason: input.reason,
        customerNote: input.customerNote ?? null,
        // An exchange swaps goods rather than money, so no refund is implied.
        refundAmount: input.type === "return" ? refundAmount : 0,
        items: { create: lines },
        events: {
          create: { status: "requested", actor: "customer", note: "درخواست توسط مشتری ثبت شد" },
        },
      },
      select: { id: true, number: true },
    });

    return request;
  });
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

const requestInclude = {
  items: true,
  events: { orderBy: { createdAt: "asc" } },
  order: { select: { number: true, createdAt: true } },
} satisfies Prisma.ReturnRequestInclude;

export async function listCustomerReturns(customerId: string) {
  const rows = await prisma.returnRequest.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: requestInclude,
  });
  return rows.map(toReturnDetail);
}

export async function getCustomerReturn(customerId: string, number: string) {
  const row = await prisma.returnRequest.findFirst({
    where: { number, customerId },
    include: requestInclude,
  });
  if (!row) throw notFound("درخواست مرجوعی پیدا نشد.");
  return toReturnDetail(row);
}

type ReturnRow = Prisma.ReturnRequestGetPayload<{ include: typeof requestInclude }>;

export function toReturnDetail(row: ReturnRow) {
  return {
    id: row.id,
    number: row.number,
    orderNumber: row.order.number,
    orderCreatedAt: row.order.createdAt.toISOString(),
    type: row.type,
    status: row.status,
    statusLabel: RETURN_STATUS_LABELS[row.status],
    reason: row.reason,
    customerNote: row.customerNote ?? undefined,
    adminNote: row.adminNote ?? undefined,
    refundAmount: row.refundAmount,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((i) => ({
      id: i.id,
      name: i.name,
      colorName: i.colorName,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    timeline: row.events.map((e) => ({
      status: e.status,
      label: RETURN_STATUS_LABELS[e.status],
      note: e.note ?? undefined,
      at: e.createdAt.toISOString(),
    })),
  };
}

export type ReturnDetail = ReturnType<typeof toReturnDetail>;

/* -------------------------------------------------------------------------- */
/* Admin                                                                       */
/* -------------------------------------------------------------------------- */

export interface AdminReturnFilters extends Pagination {
  q?: string;
  status?: ReturnStatus;
  type?: ReturnKind;
}

export async function listAdminReturns(filters: AdminReturnFilters) {
  const where: Prisma.ReturnRequestWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { order: { number: { contains: q, mode: "insensitive" } } },
      { order: { customerPhone: { contains: q } } },
      { order: { customerLastName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.returnRequest.count({ where }),
    prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        order: {
          select: {
            number: true,
            customerFirstName: true,
            customerLastName: true,
            customerPhone: true,
          },
        },
      },
      ...paginationArgs(filters),
    }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    number: row.number,
    orderNumber: row.order.number,
    customerName: `${row.order.customerFirstName} ${row.order.customerLastName}`.trim(),
    customerPhone: row.order.customerPhone,
    type: row.type,
    status: row.status,
    statusLabel: RETURN_STATUS_LABELS[row.status],
    reason: row.reason,
    refundAmount: row.refundAmount,
    itemCount: row.items.reduce((n, i) => n + i.quantity, 0),
    createdAt: row.createdAt.toISOString(),
  }));

  return paginated(items, total, filters);
}

export async function getAdminReturn(id: string) {
  const row = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      ...requestInclude,
      order: {
        select: {
          number: true,
          createdAt: true,
          customerFirstName: true,
          customerLastName: true,
          customerPhone: true,
          shipProvince: true,
          shipCity: true,
          shipAddressLine: true,
        },
      },
    },
  });
  if (!row) throw notFound("درخواست مرجوعی پیدا نشد.");

  return {
    ...toReturnDetail(row as unknown as ReturnRow),
    customer: {
      name: `${row.order.customerFirstName} ${row.order.customerLastName}`.trim(),
      phone: row.order.customerPhone,
      address: `${row.order.shipProvince}، ${row.order.shipCity}، ${row.order.shipAddressLine}`,
    },
  };
}

export interface ReturnDecisionInput {
  id: string;
  status: ReturnStatus;
  note?: string;
  adminNote?: string;
}

/**
 * Moves a request along its workflow.
 *
 * Reaching `received` returns the goods to stock, in the same transaction, so
 * inventory and the request's state can never disagree.
 */
export async function decideReturn(input: ReturnDecisionInput) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.returnRequest.findUnique({
      where: { id: input.id },
      include: { items: { include: { orderItem: true } } },
    });
    if (!request) throw notFound("درخواست مرجوعی پیدا نشد.");

    if (!canTransitionReturn(request.status, input.status)) {
      throw conflict(
        `تغییر وضعیت از «${RETURN_STATUS_LABELS[request.status]}» به «${RETURN_STATUS_LABELS[input.status]}» مجاز نیست.`
      );
    }

    // The goods are physically back at `received`, so that is when stock moves.
    if (input.status === "received") {
      await restoreStock(
        tx,
        request.items.map((i) => ({
          variantId: i.orderItem.variantId,
          quantity: i.quantity,
        }))
      );
    }

    await tx.returnRequest.update({
      where: { id: input.id },
      data: {
        status: input.status,
        ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
      },
    });

    await tx.returnRequestEvent.create({
      data: {
        returnRequestId: input.id,
        status: input.status,
        note: input.note ?? null,
        actor: "admin",
      },
    });

    return { number: request.number, orderId: request.orderId };
  });
}
