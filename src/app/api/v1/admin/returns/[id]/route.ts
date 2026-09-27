import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { decideReturn, getAdminReturn } from "@/server/services/returns";
import { returnDecisionSchema } from "@/server/schemas/admin";

/**
 * GET / PATCH /api/v1/admin/returns/[id]
 *
 * Reaching `received` returns the goods to stock inside the same transaction
 * as the status change — see `services/returns`.
 */

type Params = { id: string };

export const GET = adminRoute<Params>(async (_request, { params }) =>
  ok({ request: await getAdminReturn(params.id) })
);

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, returnDecisionSchema);
  const result = await decideReturn({
    id: params.id,
    status: input.status,
    note: input.note,
    adminNote: input.adminNote,
  });

  await audit({
    action: "return.decision",
    entityType: "return_request",
    entityId: params.id,
    summary: `درخواست مرجوعی ${result.number} به وضعیت «${input.status}» تغییر کرد`,
    meta: { status: input.status, note: input.note },
  });

  return ok({ request: await getAdminReturn(params.id) });
});
