import { z } from "zod";
import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteSize, updateSize } from "@/server/services/taxonomy";
import { optionalText } from "@/server/lib/validation";

/** PATCH / DELETE /api/v1/admin/sizes/[id] */

type Params = { id: string };

const patchSchema = z.object({ label: optionalText(20), active: z.boolean().optional() });

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, patchSchema);
  const size = await updateSize(params.id, input);
  await audit({
    action: "size.update",
    entityType: "size",
    entityId: size.id,
    summary: `سایز ${size.label} ویرایش شد`,
  });
  return ok({ size });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  const result = await deleteSize(params.id);
  await audit({
    action: "size.delete",
    entityType: "size",
    entityId: params.id,
    summary: result.message,
  });
  return ok(result);
});
