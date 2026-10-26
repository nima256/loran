import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteShippingMethod, updateShippingMethod } from "@/server/services/settings";
import { shippingMethodSchema } from "@/server/schemas/admin";

/** PATCH / DELETE /api/v1/admin/shipping/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, shippingMethodSchema.partial());
  const method = await updateShippingMethod(params.id, input);

  await audit({
    action: "shipping.update",
    entityType: "shipping_method",
    entityId: method.id,
    summary: `روش ارسال «${method.name}» ویرایش شد`,
    meta: { cost: input.cost, active: input.active, paidOnDelivery: input.paidOnDelivery },
  });

  return ok({ method });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  const result = await deleteShippingMethod(params.id);
  await audit({
    action: "shipping.update",
    entityType: "shipping_method",
    entityId: params.id,
    summary: result.message,
  });
  return ok(result);
});
