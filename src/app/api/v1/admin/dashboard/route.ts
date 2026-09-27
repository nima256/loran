import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import {
  getBestSellers,
  getDashboardKpis,
  getInventorySummary,
  getLowStockVariants,
  getOrderSeries,
  getOrderStatusDistribution,
  getRecentOrders,
  getRevenueByCategory,
  getRevenueSeries,
  parseRange,
} from "@/server/services/analytics";
import { prisma } from "@/server/lib/prisma";
import { optionalText } from "@/server/lib/validation";

/**
 * GET /api/v1/admin/dashboard?from=&to=
 *
 * Every figure comes from the database. The date range drives all of them, so
 * the admin's range selector is real rather than decorative.
 */

const querySchema = z.object({
  from: optionalText(40),
  to: optionalText(40),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const { from, to, days } = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
  const range = parseRange(from, to, days);

  const [
    kpis, revenueSeries, orderSeries, bestSellers, revenueByCategory,
    statusDistribution, recentOrders, lowStock, inventory, pendingReviews, openReturns, newRequests,
  ] = await Promise.all([
    getDashboardKpis(range),
    getRevenueSeries(range),
    getOrderSeries(range),
    getBestSellers(range),
    getRevenueByCategory(range),
    getOrderStatusDistribution(range),
    getRecentOrders(8),
    getLowStockVariants(3, 8),
    getInventorySummary(),
    prisma.review.count({ where: { status: "pending" } }),
    prisma.returnRequest.count({ where: { status: { in: ["requested", "info_requested"] } } }),
    prisma.consultationRequest.count({ where: { status: "new" } }),
  ]);

  return ok({
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    kpis,
    revenueSeries,
    orderSeries,
    bestSellers,
    revenueByCategory,
    statusDistribution,
    recentOrders,
    lowStock,
    inventory,
    /** Counts for the sidebar badges — work waiting on the administrator. */
    queues: { pendingReviews, openReturns, newRequests },
  });
});
