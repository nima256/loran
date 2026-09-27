import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
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
