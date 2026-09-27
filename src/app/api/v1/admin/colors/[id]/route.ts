import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteColor, updateColor } from "@/server/services/taxonomy";
import { colorSchema } from "@/server/schemas/admin";

/** PATCH / DELETE /api/v1/admin/colors/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, colorSchema.partial());
  const color = await updateColor(params.id, input);
  await audit({
    action: "color.update",
    entityType: "color",
    entityId: color.id,
    summary: `رنگ «${color.name}» ویرایش شد`,
  });
  return ok({ color });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  const result = await deleteColor(params.id);
  await audit({
    action: "color.delete",
    entityType: "color",
    entityId: params.id,
    summary: result.message,
  });
  return ok(result);
});
