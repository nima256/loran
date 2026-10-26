import { handler, ok } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { listCustomerReviews } from "@/server/services/reviews";

/**
 * GET /api/v1/account/reviews
 *
 * Includes the customer's pending and rejected reviews — they wrote them, so
 * they can see where each one stands.
 */
export const GET = handler(async () => {
  const customer = await requireCustomer();
  return ok({ reviews: await listCustomerReviews(customer.id) });
});
