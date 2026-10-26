import { handler, ok } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { getCustomerOrder } from "@/server/services/order-queries";

/**
 * GET /api/v1/account/orders/[number]
 *
 * Ownership is part of the query, not a check afterwards: asking for another
 * customer's order number returns the same "not found" as a number that does
 * not exist, so it cannot be used to confirm an order is real.
 */

type Params = { params: Promise<{ number: string }> };

export const GET = handler<Params>(async (_request, { params }) => {
  const customer = await requireCustomer();
  const { number } = await params;
  return ok({ order: await getCustomerOrder(customer.id, decodeURIComponent(number)) });
});
