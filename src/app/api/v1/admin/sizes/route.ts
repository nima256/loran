import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createSize, listSizes } from "@/server/services/taxonomy";
import { sizeSchema } from "@/server/schemas/admin";

/** GET / POST /api/v1/admin/sizes */

export const GET = adminRoute(async () => ok({ sizes: await listSizes({ includeInactive: true }) }));

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, sizeSchema);
  const size = await createSize(input.value, input.label);
  await audit({
    action: "size.create",
    entityType: "size",
    entityId: size.id,
    summary: `سایز ${size.label} اضافه شد`,
  });
  return created({ size });
});
