import "server-only";
import { Prisma, type OrderStatus, type PaymentStatus, type OrderSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { paginated, paginationArgs, type Pagination } from "../lib/validation";
import { normalizeIranMobile } from "@/lib/persian";
import type { Address, Order, OrderItem, OrderTimelineEntry, PaymentMethod } from "@/types";

/**
 * Order reads.
 *
 * Separated from `orders.ts` (which mutates) so the read paths stay easy to
 * reason about. Every order rendered anywhere in the app is assembled here from
 * the order's own snapshot columns — never by joining back to the current
 * product or address rows, which would make an old order re-render with today's
 * prices and yesterday's history.
 */

const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** The extra fields the UI needs beyond the shared `Order` type. */
export interface OrderDetail extends Order {
  source: OrderSource;
  paymentStatus: PaymentStatus;
  carrier?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  adminNote?: string;
  customerNote?: string;
  shippingMethodName: string;
  shippingPaidOnDelivery: boolean;
}

function toItem(row: OrderRow["items"][number]): OrderItem {
  return {
    productId: row.productId ?? "",
    variantId: row.variantId ?? "",
    slug: row.slug,
    name: row.name,
    image: row.image,
    colorName: row.colorName,
    colorHex: row.colorHex,
    size: row.size,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    compareAtPrice: row.compareAtPrice ?? undefined,
  };
}

function toTimeline(row: OrderRow["events"][number]): OrderTimelineEntry {
  return {
    status: row.status,
    at: row.createdAt.toISOString(),
    note: row.note ?? undefined,
  };
}

/** The snapshotted address, rebuilt in the shape the UI renders. */
function toSnapshotAddress(row: OrderRow): Address {
  return {
    id: `${row.id}-address`,
    title: "آدرس سفارش",
    recipientFirstName: row.shipRecipientFirstName,
    recipientLastName: row.shipRecipientLastName,
    phone: row.shipPhone,
    province: row.shipProvince,
    city: row.shipCity,
    addressLine: row.shipAddressLine,
    postalCode: row.shipPostalCode,
    plaque: row.shipPlaque ?? undefined,
    unit: row.shipUnit ?? undefined,
    isDefault: false,
  };
}

export function toOrderDetail(row: OrderRow): OrderDetail {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    source: row.source,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map(toItem),
    totals: {
      subtotal: row.subtotal,
      productDiscount: row.productDiscount,
      couponDiscount: row.couponDiscount,
      shippingCost: row.shippingCost,
      payableOnline: row.payableOnline,
      grandTotal: row.grandTotal,
    },
    couponCode: row.couponCode ?? undefined,
    address: toSnapshotAddress(row),
    shippingMethod: row.shippingMethodCode as Order["shippingMethod"],
    shippingMethodName: row.shippingMethodName,
    shippingPaidOnDelivery: row.shippingPaidOnDelivery,
    carrier: row.carrier ?? undefined,
    trackingCode: row.trackingCode ?? undefined,
    paymentMethod: row.paymentMethod as PaymentMethod,
    paymentRef: row.paymentRef ?? undefined,
    paidAt: row.paidAt?.toISOString(),
    timeline: row.events.map(toTimeline),
    estimatedDelivery: row.estimatedDelivery?.toISOString(),
    smsNotifications: row.smsNotifications,
    customerName: `${row.customerFirstName} ${row.customerLastName}`.trim(),
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail ?? undefined,
    customerNote: row.customerNote ?? undefined,
    adminNote: row.adminNote ?? undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* Customer-facing                                                             */
/* -------------------------------------------------------------------------- */

export async function listCustomerOrders(customerId: string): Promise<OrderDetail[]> {
  const rows = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: orderInclude,
    take: 100,
  });
  return rows.map(toOrderDetail);
}

/**
 * One order, scoped to its owner.
 *
 * `customerId` is part of the WHERE clause rather than checked afterwards, so
 * asking for another customer's order number is indistinguishable from asking
 * for one that does not exist — it cannot be used to confirm an order exists.
 */
export async function getCustomerOrder(
  customerId: string,
  number: string
): Promise<OrderDetail> {
  const row = await prisma.order.findFirst({
    where: { number, customerId },
    include: orderInclude,
  });
  if (!row) throw notFound("سفارش پیدا نشد.");
  return toOrderDetail(row);
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                       */
/* -------------------------------------------------------------------------- */

export interface AdminOrderFilters extends Pagination {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  source?: OrderSource;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "total-desc" | "total-asc";
}

function adminWhere(filters: AdminOrderFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
  if (filters.source) where.source = filters.source;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: endOfDay(filters.to) } : {}),
    };
  }

  const q = filters.q?.trim();
  if (q) {
    // A phone number is normalised before matching, so «۰۹۱۲…» and "+98912…"
    // both find the order.
    const phone = normalizeIranMobile(q);
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { customerFirstName: { contains: q, mode: "insensitive" } },
      { customerLastName: { contains: q, mode: "insensitive" } },
      { trackingCode: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: phone || q } },
    ];
  }

  return where;
}

const ADMIN_ORDER_SORT: Record<
  NonNullable<AdminOrderFilters["sort"]>,
  Prisma.OrderOrderByWithRelationInput
> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  "total-desc": { grandTotal: "desc" },
  "total-asc": { grandTotal: "asc" },
};

/** Server-side paginated, searchable, filterable order list for the admin. */
export async function listAdminOrders(filters: AdminOrderFilters) {
  const where = adminWhere(filters);
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: ADMIN_ORDER_SORT[filters.sort ?? "newest"],
      include: { items: { select: { id: true, name: true, quantity: true, image: true } } },
      ...paginationArgs(filters),
    }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    paymentStatus: row.paymentStatus,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    customerName: `${row.customerFirstName} ${row.customerLastName}`.trim(),
    customerPhone: row.customerPhone,
    grandTotal: row.grandTotal,
    payableOnline: row.payableOnline,
    itemCount: row.items.reduce((n, i) => n + i.quantity, 0),
    firstItemName: row.items[0]?.name ?? "",
    firstItemImage: row.items[0]?.image ?? "",
    trackingCode: row.trackingCode,
    carrier: row.carrier,
    shippingMethodName: row.shippingMethodName,
  }));

  return paginated(items, total, filters);
}

export type AdminOrderListItem = Awaited<ReturnType<typeof listAdminOrders>>["items"][number];

export async function getAdminOrder(number: string): Promise<OrderDetail> {
  const row = await prisma.order.findUnique({ where: { number }, include: orderInclude });
  if (!row) throw notFound("سفارش پیدا نشد.");
  return toOrderDetail(row);
}

export async function getAdminOrderById(id: string): Promise<OrderDetail> {
  const row = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!row) throw notFound("سفارش پیدا نشد.");
  return toOrderDetail(row);
}

/** Inclusive end of the given day, for date-range filters. */
export function endOfDay(value: string): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
