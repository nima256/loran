import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { updateConsultation } from "@/server/services/submissions";
import { requestUpdateSchema } from "@/server/schemas/admin";

/** PATCH /api/v1/admin/consultations/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, requestUpdateSchema);
  const result = await updateConsultation(params.id, input);

  await audit({
    action: "consultation.update",
    entityType: "consultation",
    entityId: params.id,
    summary: `درخواست مشاوره ${result.number} به‌روزرسانی شد`,
    meta: { status: input.status },
  });

  return ok({ request: result });
});
