import { handler, ok } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { listCustomerOrders } from "@/server/services/order-queries";

/** GET /api/v1/account/orders — the signed-in customer's orders. */
export const GET = handler(async () => {
  const customer = await requireCustomer();
  return ok({ orders: await listCustomerOrders(customer.id) });
});
