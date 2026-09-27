import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createShippingMethod, listShippingMethodsForAdmin } from "@/server/services/settings";
import { shippingMethodSchema } from "@/server/schemas/admin";

/** GET / POST /api/v1/admin/shipping */

export const GET = adminRoute(async () => ok({ methods: await listShippingMethodsForAdmin() }));

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, shippingMethodSchema);
  const method = await createShippingMethod(input);

  await audit({
    action: "shipping.update",
    entityType: "shipping_method",
    entityId: method.id,
    summary: `روش ارسال «${method.name}» ایجاد شد`,
  });

  return created({ method });
});
