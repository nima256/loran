import { handler, ok } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { prisma } from "@/server/lib/prisma";
import { listCustomerOrders } from "@/server/services/order-queries";

/**
 * GET /api/v1/account/summary — everything the account dashboard shows.
 *
 * One request rather than four, because the dashboard renders all of it at
 * once and four round-trips would each get their own loading state.
 */
export const GET = handler(async () => {
  const customer = await requireCustomer();

  const [orders, addressCount, returnCount, reviewCount] = await Promise.all([
    listCustomerOrders(customer.id),
    prisma.address.count({ where: { customerId: customer.id } }),
    prisma.returnRequest.count({ where: { customerId: customer.id } }),
    prisma.review.count({ where: { customerId: customer.id } }),
  ]);

  const openStatuses = ["preparing", "packaged", "shipped"];

  return ok({
    counts: {
      orders: orders.length,
      openOrders: orders.filter((o) => openStatuses.includes(o.status)).length,
      addresses: addressCount,
      returns: returnCount,
      reviews: reviewCount,
    },
    recentOrders: orders.slice(0, 3),
  });
});
