import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { listAdminOrders } from "@/server/services/order-queries";
import { orderFilterSchema } from "@/server/schemas/admin";

/** GET /api/v1/admin/orders — server-side paginated, searchable, filterable. */
export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = orderFilterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await listAdminOrders(filters));
});
