import { z } from "zod";
import { hideAdminOrder } from "@/server/services/order-deletion";
import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { getAdminOrderById } from "@/server/services/order-queries";
import { allowedTransitions } from "@/server/services/order-status";
import { listTrackingCarriers } from "@/server/services/shipping";

/** GET /api/v1/admin/orders/[id] */

type Params = { id: string };

export const GET = adminRoute<Params>(async (_request, { params }) => {
  const order = await getAdminOrderById(params.id);
  return ok({
    order,
    // The UI offers only transitions the workflow actually permits, so an
    // impossible status is never even presented.
    allowedStatuses: allowedTransitions(order.status),
    carriers: await listTrackingCarriers(),
  });
});

const deleteConfirmation = z.object({
  orderNumber: z.string().min(5).max(60),
  acknowledged: z.literal(true),
});

/** DELETE /api/v1/admin/orders/[id] — soft deletion, accounting preserved. */
export const DELETE = adminRoute<Params>(async (request, { params, audit }) => {
  const confirmation = await adminBody(request, deleteConfirmation);
  const removed = await hideAdminOrder(params.id, confirmation.orderNumber);
  await audit({
    action: "order.delete",
    entityType: "order",
    entityId: removed.id,
    summary: `سفارش ${removed.number} از لیست‌ها حذف شد؛ سوابق مالی و موجودی نگهداری شدند`,
    meta: { number: removed.number, status: removed.status, paymentStatus: removed.paymentStatus },
  });
  return ok({ message: "سفارش از فهرست‌ها حذف شد. سوابق پرداخت و موجودی برای حسابرسی باقی ماند." });
});
