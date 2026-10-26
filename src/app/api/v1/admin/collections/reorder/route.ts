import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { reorderCollections } from "@/server/services/taxonomy";
import { reorderSchema } from "@/server/schemas/admin";
import { revalidateStorefront } from "@/server/lib/revalidate";

/** POST /api/v1/admin/collections/reorder — `{ ids }` in their new order. */

export const POST = adminRoute(async (request, { audit }) => {
  const { ids } = await adminBody(request, reorderSchema);
  await reorderCollections(ids);

  await audit({
    action: "collection.reorder",
    entityType: "collection",
    summary: "ترتیب کالکشن‌ها تغییر کرد",
  });
  revalidateStorefront();

  return ok({ reordered: ids.length });
});
