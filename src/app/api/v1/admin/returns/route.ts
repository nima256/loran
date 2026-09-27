import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { listAdminReturns } from "@/server/services/returns";
import { paginationSchema } from "@/server/lib/validation";
import { prisma } from "@/server/lib/prisma";

/** GET /api/v1/admin/returns */

const filterSchema = paginationSchema.extend({
  q: z.string().max(120).optional(),
  status: z
    .enum([
      "requested", "info_requested", "approved", "rejected",
      "in_transit", "received", "completed", "refunded", "cancelled",
    ])
    .optional(),
  type: z.enum(["return", "exchange"]).optional(),
});

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  const [list, openCount] = await Promise.all([
    listAdminReturns(filters),
    prisma.returnRequest.count({ where: { status: { in: ["requested", "info_requested"] } } }),
  ]);
  return ok({ ...list, openCount });
});
