import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { listConsultations } from "@/server/services/submissions";
import { requestFilterSchema } from "@/server/schemas/admin";
import { prisma } from "@/server/lib/prisma";

/** GET /api/v1/admin/consultations */
export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = requestFilterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  const [list, newCount] = await Promise.all([
    listConsultations(filters),
    prisma.consultationRequest.count({ where: { status: "new" } }),
  ]);
  return ok({ ...list, newCount });
});
