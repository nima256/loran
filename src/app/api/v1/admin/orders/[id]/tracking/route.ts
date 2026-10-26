import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { setTracking } from "@/server/services/orders";
import { getAdminOrderById } from "@/server/services/order-queries";
import { sendPatternSmsQuietly } from "@/server/services/sms";
import { trackingSchema } from "@/server/schemas/admin";

/**
 * POST /api/v1/admin/orders/[id]/tracking
 *
 * Persists the carrier and tracking code, writes a timeline event and — when
 * the order is ready for it — advances the status to `shipped`. The code is
 * immediately visible on the customer's order page because both read the same
 * row; nothing about it lives in admin front-end state.
 */

type Params = { id: string };

export const POST = adminRoute<Params>(async (request, { params, admin, audit }) => {
  const input = await adminBody(request, trackingSchema);

  const result = await setTracking({
    orderId: params.id,
    carrier: input.carrier,
    trackingCode: input.trackingCode,
    actorId: admin.id,
  });

  await audit({
    action: "order.tracking",
    entityType: "order",
    entityId: params.id,
    summary: `کد رهگیری سفارش ${result.number} ثبت شد (${input.carrier})`,
    meta: { carrier: input.carrier, advanced: result.advanced },
  });

  let smsSent = false;
  if (input.notifyCustomer && result.notify) {
    // Quietly: a provider outage must not undo a tracking code that is saved.
    const sms = await sendPatternSmsQuietly("orderShipped", result.phone, [
      result.number,
      input.trackingCode,
    ]);
    smsSent = Boolean(sms && !sms.mocked);
  }

  return ok({
    order: await getAdminOrderById(params.id),
    advancedToShipped: result.advanced,
    smsSent,
  });
});
