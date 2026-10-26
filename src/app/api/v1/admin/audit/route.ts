import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { listAuditLog } from "@/server/services/settings";
import { paginationSchema } from "@/server/lib/validation";

/** GET /api/v1/admin/audit — the administrative action log. */

const filterSchema = paginationSchema.extend({ action: z.string().max(60).optional() });

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await listAuditLog(filters));
});
