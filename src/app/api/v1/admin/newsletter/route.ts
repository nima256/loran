import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { listNewsletterSubscribers } from "@/server/services/submissions";
import { paginationSchema } from "@/server/lib/validation";

/** GET /api/v1/admin/newsletter — subscriber list. */

const filterSchema = paginationSchema.extend({ q: z.string().max(120).optional() });

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await listNewsletterSubscribers(filters));
});
