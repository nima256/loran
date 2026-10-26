import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { changeOrderStatus } from "@/server/services/orders";
import { getAdminOrderById } from "@/server/services/order-queries";
import { badRequest } from "@/server/lib/errors";
import { orderStatusSchema } from "@/server/schemas/admin";

/**
 * POST /api/v1/admin/orders/[id]/status
 *
 * The workflow is enforced in the service, so an arbitrary status posted
 * directly at this endpoint is rejected the same way one from the UI would be.
 */

type Params = { id: string };

export const POST = adminRoute<Params>(async (request, { params, admin, audit }) => {
  const input = await adminBody(request, orderStatusSchema);
  const before = await getAdminOrderById(params.id);

  if (input.status === "cancelled" && (
    input.cancellationConfirmation?.orderNumber !== before.number ||
    input.cancellationConfirmation?.acknowledged !== true
  )) {
    throw badRequest("برای لغو سفارش، تأیید دومرحله‌ای لازم است.");
  }

  await changeOrderStatus({
    orderId: params.id,
    status: input.status,
    expectedStatus: input.expectedStatus,
    undo: input.undo,
    note: input.note,
    actor: "admin",
    actorId: admin.id,
  });

  await audit({
    action: "order.status",
    entityType: "order",
    entityId: params.id,
    summary: `${input.undo ? "بازگشت وضعیت" : "تغییر وضعیت"} سفارش ${before.number} از «${before.status}» به «${input.status}»`,
    meta: { from: before.status, to: input.status, undo: input.undo === true, note: input.note },
  });

  return ok({ order: await getAdminOrderById(params.id) });
});
