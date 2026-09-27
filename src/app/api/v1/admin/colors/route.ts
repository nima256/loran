import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createColor, listColors } from "@/server/services/taxonomy";
import { colorSchema } from "@/server/schemas/admin";

/** GET / POST /api/v1/admin/colors */

export const GET = adminRoute(async () => ok({ colors: await listColors({ includeInactive: true }) }));

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, colorSchema);
  const color = await createColor(input);

  await audit({
    action: "color.create",
    entityType: "color",
    entityId: color.id,
    summary: `رنگ «${color.name}» اضافه شد`,
    meta: { hex: color.hex },
  });

  return created({ color });
});
