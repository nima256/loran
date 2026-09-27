import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { searchProductsForManualOrder } from "@/server/services/manual-orders";

/**
 * GET /api/v1/admin/orders/products?q=…
 *
 * The product picker behind the manual-order form. Carries live stock for every
 * colour/size so the administrator cannot choose an unavailable combination.
 */

const querySchema = z.object({
  q: z.string().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const { q, limit } = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok({ products: await searchProductsForManualOrder(q, limit) });
});
