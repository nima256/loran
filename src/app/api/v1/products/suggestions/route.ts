import { z } from "zod";
import { handler, ok, readQuery } from "@/server/lib/http";
import { getSearchSuggestions } from "@/server/services/catalog";

/**
 * GET /api/v1/products/suggestions?q=…
 *
 * Backs the header search overlay. Exists so the overlay — a client component —
 * can query the catalogue without importing the catalogue service, which would
 * pull the whole product table into the browser bundle.
 */

const querySchema = z.object({
  q: z.string().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(12).default(6),
});

export const GET = handler(async (request) => {
  const { q, limit } = readQuery(request, querySchema);
  if (!q.trim()) return ok({ items: [] });
  return ok({ items: await getSearchSuggestions(q, limit) });
});
