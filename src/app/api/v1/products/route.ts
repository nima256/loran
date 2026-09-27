import { z } from "zod";
import { handler, ok } from "@/server/lib/http";
import { searchProducts } from "@/server/services/catalog";
import { parseFilters } from "@/lib/shop-params";

/**
 * GET /api/v1/products — the public catalogue query.
 *
 * Accepts exactly the query string the storefront already puts in the URL, so
 * the filter vocabulary has one definition (`lib/shop-params`) shared by the
 * pages and the API.
 */
export const GET = handler(async (request) => {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) raw[key] = value;

  // Guard the page number before it reaches the database.
  z.object({ page: z.coerce.number().int().min(1).max(1000).optional() }).parse(raw);

  return ok(await searchProducts(parseFilters(raw)));
});
