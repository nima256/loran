import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteCollection, updateCollection } from "@/server/services/taxonomy";
import { collectionSchema } from "@/server/schemas/admin";
import { revalidateStorefront } from "@/server/lib/revalidate";

/** PATCH / DELETE /api/v1/admin/collections/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, collectionSchema.partial());
  const collection = await updateCollection(params.id, input);

  await audit({
    action: "collection.update",
    entityType: "collection",
    entityId: collection.id,
    summary: `کالکشن «${collection.name}» ویرایش شد`,
    meta: input as Record<string, unknown>,
  });
  revalidateStorefront();

  return ok({ collection });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  // Deleted when empty, deactivated when products still belong to it — the
  // response says which, so the screen can tell the administrator.
  const result = await deleteCollection(params.id);

  await audit({
    action: result.action === "deleted" ? "collection.delete" : "collection.archive",
    entityType: "collection",
    entityId: params.id,
    summary: result.message,
  });
  revalidateStorefront();

  return ok(result);
});
