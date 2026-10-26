import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { REVENUE_STATUSES } from "./order-status";

/**
 * Dashboard and reporting queries.
 *
 * Every number here comes from the database. The rule that matters most:
 * **revenue only counts orders that were actually paid for**. A cancelled,
 * failed, expired or still-unpaid order contributes nothing, which is why every
 * query below filters on `paymentStatus: "paid"` and excludes the refunded and
 * cancelled statuses rather than simply summing `grandTotal`.
 *
 * `payableOnline` is used for revenue rather than `grandTotal`, because
 * postpaid Tipax shipping is collected by the courier and was never Loran's
 * money.
 */

/** Orders whose money is real: paid for, and not since cancelled or refunded. */
const PAID_ORDER: Prisma.OrderWhereInput = {
  paymentStatus: "paid",
  status: { in: REVENUE_STATUSES },
};

export interface DateRange {
  from: Date;
  to: Date;
}

/** The last `days` days, ending now. */
export function lastDays(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function parseRange(from?: string, to?: string, fallbackDays = 30): DateRange {
  if (!from && !to) return lastDays(fallbackDays);
  const start = from ? new Date(from) : lastDays(fallbackDays).from;
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

function inRange(range: DateRange): Prisma.OrderWhereInput {
  return { createdAt: { gte: range.from, lte: range.to } };
}

/* -------------------------------------------------------------------------- */
/* Headline KPIs                                                               */
/* -------------------------------------------------------------------------- */

export interface DashboardKpis {
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
  customerCount: number;
  newCustomers: number;
  /** Orders taken but not yet paid for — not counted as revenue. */
  pendingOrders: number;
  /** Percentage change against the immediately preceding window. */
  revenueChange: number;
  orderChange: number;
}

export async function getDashboardKpis(range: DateRange): Promise<DashboardKpis> {
  // The preceding window of equal length, for the change figures.
  const span = range.to.getTime() - range.from.getTime();
  const previous: DateRange = {
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime()),
  };

  const [current, prior, customerCount, newCustomers, pendingOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { ...PAID_ORDER, ...inRange(range) },
      _sum: { payableOnline: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { ...PAID_ORDER, ...inRange(previous) },
      _sum: { payableOnline: true },
      _count: { _all: true },
    }),
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.order.count({
      where: { paymentStatus: "pending", status: "awaiting_payment" },
    }),
  ]);

  const revenue = current._sum.payableOnline ?? 0;
  const orderCount = current._count._all;
  const priorRevenue = prior._sum.payableOnline ?? 0;
  const priorOrders = prior._count._all;

  return {
    revenue,
    orderCount,
    averageOrderValue: orderCount ? Math.round(revenue / orderCount) : 0,
    customerCount,
    newCustomers,
    pendingOrders,
    revenueChange: percentChange(revenue, priorRevenue),
    orderChange: percentChange(orderCount, priorOrders),
  };
}

function percentChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/* -------------------------------------------------------------------------- */
/* Series                                                                      */
/* -------------------------------------------------------------------------- */

export interface SeriesPoint {
  label: string;
  value: number;
  /** ISO date, for charts that need to sort or format themselves. */
  date: string;
}

/**
 * Revenue per day across the range.
 *
 * Gaps are filled with zero, so a quiet day renders as a zero rather than
 * disappearing and making the chart lie about its time axis.
 */
export async function getRevenueSeries(range: DateRange): Promise<SeriesPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; total: bigint | number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, SUM("payableOnline")::bigint AS total
    FROM orders
    WHERE "paymentStatus" = 'paid'
      AND "status" IN ('preparing','packaged','shipped','delivered')
      AND "createdAt" BETWEEN ${range.from} AND ${range.to}
    GROUP BY day
    ORDER BY day ASC
  `;

  const byDay = new Map(rows.map((r) => [dayKey(r.day), Number(r.total)]));
  return fillDays(range, (date) => ({
    label: formatDayLabel(date),
    value: byDay.get(dayKey(date)) ?? 0,
    date: date.toISOString(),
  }));
}

/** Order counts per day. */
export async function getOrderSeries(range: DateRange): Promise<SeriesPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; total: bigint | number }[]>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS total
    FROM orders
    WHERE "paymentStatus" = 'paid'
      AND "status" IN ('preparing','packaged','shipped','delivered')
      AND "createdAt" BETWEEN ${range.from} AND ${range.to}
    GROUP BY day
    ORDER BY day ASC
  `;
  const byDay = new Map(rows.map((r) => [dayKey(r.day), Number(r.total)]));
  return fillDays(range, (date) => ({
    label: formatDayLabel(date),
    value: byDay.get(dayKey(date)) ?? 0,
    date: date.toISOString(),
  }));
}

const dayKey = (date: Date) => new Date(date).toISOString().slice(0, 10);

const faDay = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });
const formatDayLabel = (date: Date) => faDay.format(date);

function fillDays<T>(range: DateRange, make: (date: Date) => T): T[] {
  const out: T[] = [];
  const cursor = new Date(range.from);
  cursor.setHours(0, 0, 0, 0);
  // Guard against an absurd range producing an unbounded array.
  for (let i = 0; cursor <= range.to && i < 400; i++) {
    out.push(make(new Date(cursor)));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Breakdowns                                                                  */
/* -------------------------------------------------------------------------- */

export interface BestSeller {
  productId: string;
  slug: string;
  label: string;
  /** Units sold in the range. */
  value: number;
  revenue: number;
}

export async function getBestSellers(range: DateRange, limit = 6): Promise<BestSeller[]> {
  const rows = await prisma.$queryRaw<
    { productId: string; slug: string; name: string; units: bigint; revenue: bigint }[]
  >`
    SELECT oi."productId",
           MAX(oi."slug")  AS slug,
           MAX(oi."name")  AS name,
           SUM(oi."quantity")::bigint                      AS units,
           SUM(oi."quantity" * oi."unitPrice")::bigint      AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    WHERE o."paymentStatus" = 'paid'
      AND o."status" IN ('preparing','packaged','shipped','delivered')
      AND o."createdAt" BETWEEN ${range.from} AND ${range.to}
      AND oi."productId" IS NOT NULL
    GROUP BY oi."productId"
    ORDER BY units DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    productId: row.productId,
    slug: row.slug,
    label: row.name.replace("لوران مدل ", ""),
    value: Number(row.units),
    revenue: Number(row.revenue),
  }));
}

export async function getRevenueByCategory(range: DateRange, limit = 8) {
  const rows = await prisma.$queryRaw<{ name: string; revenue: bigint }[]>`
    SELECT c."name",
           SUM(oi."quantity" * oi."unitPrice")::bigint AS revenue
    FROM order_items oi
    JOIN orders o             ON o.id = oi."orderId"
    JOIN product_categories pc ON pc."productId" = oi."productId"
    JOIN categories c          ON c.id = pc."categoryId"
    WHERE o."paymentStatus" = 'paid'
      AND o."status" IN ('preparing','packaged','shipped','delivered')
      AND o."createdAt" BETWEEN ${range.from} AND ${range.to}
    GROUP BY c."name"
    ORDER BY revenue DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ label: row.name, value: Number(row.revenue) }));
}

/** How orders are distributed across the workflow — all statuses, not just paid. */
export async function getOrderStatusDistribution(range: DateRange) {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: inRange(range),
    _count: { _all: true },
  });
  return rows.map((row) => ({ status: row.status, value: row._count._all }));
}

export async function getRecentOrders(limit = 8) {
  const rows = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      source: true,
      grandTotal: true,
      createdAt: true,
      customerFirstName: true,
      customerLastName: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    paymentStatus: row.paymentStatus,
    source: row.source,
    total: row.grandTotal,
    createdAt: row.createdAt.toISOString(),
    customerName: `${row.customerFirstName} ${row.customerLastName}`.trim(),
  }));
}

/** Variants at or below the threshold, worst first. */
export async function getLowStockVariants(threshold = 3, limit = 10) {
  const rows = await prisma.productVariant.findMany({
    where: { active: true, stock: { lte: threshold }, product: { active: true } },
    orderBy: [{ stock: "asc" }],
    take: limit,
    include: {
      product: { select: { name: true, slug: true } },
      color: { select: { name: true } },
      size: { select: { value: true } },
    },
  });

  return rows.map((row) => ({
    variantId: row.id,
    sku: row.sku,
    productName: row.product.name,
    productSlug: row.product.slug,
    colorName: row.color.name,
    size: row.size.value,
    stock: row.stock,
  }));
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                   */
/* -------------------------------------------------------------------------- */

export interface InventorySummary {
  totalVariants: number;
  outOfStockCount: number;
  lowStockCount: number;
  totalUnits: number;
  /** Retail value of everything on the shelf. */
  inventoryValue: number;
}

export async function getInventorySummary(lowStockThreshold = 3): Promise<InventorySummary> {
  const [counts, value] = await Promise.all([
    prisma.$queryRaw<
      { total: bigint; out_of_stock: bigint; low_stock: bigint; units: bigint }[]
    >`
      SELECT COUNT(*)::bigint                                                    AS total,
             COUNT(*) FILTER (WHERE v."stock" = 0)::bigint                        AS out_of_stock,
             COUNT(*) FILTER (WHERE v."stock" > 0
                                AND v."stock" <= ${lowStockThreshold})::bigint    AS low_stock,
             COALESCE(SUM(v."stock"), 0)::bigint                                  AS units
      FROM product_variants v
      JOIN products p ON p.id = v."productId"
      WHERE v.active AND p.active
    `,
    prisma.$queryRaw<{ value: bigint | null }[]>`
      SELECT COALESCE(SUM(v."stock" * COALESCE(v."price", p."price")), 0)::bigint AS value
      FROM product_variants v
      JOIN products p ON p.id = v."productId"
      WHERE v.active AND p.active
    `,
  ]);

  const row = counts[0];
  return {
    totalVariants: Number(row?.total ?? 0),
    outOfStockCount: Number(row?.out_of_stock ?? 0),
    lowStockCount: Number(row?.low_stock ?? 0),
    totalUnits: Number(row?.units ?? 0),
    inventoryValue: Number(value[0]?.value ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Coupons                                                                     */
/* -------------------------------------------------------------------------- */

export async function getCouponPerformance(limit = 10) {
  const rows = await prisma.coupon.findMany({
    orderBy: { usageCount: "desc" },
    take: limit,
    include: {
      redemptions: { select: { amount: true } },
    },
  });

  return rows.map((row) => ({
    code: row.code,
    description: row.description,
    active: row.active,
    usageCount: row.usageCount,
    usageLimit: row.usageLimit,
    totalDiscount: row.redemptions.reduce((n, r) => n + r.amount, 0),
  }));
}
