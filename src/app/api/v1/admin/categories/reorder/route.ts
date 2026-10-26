import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { reorderCategories } from "@/server/services/taxonomy";
import { reorderSchema } from "@/server/schemas/admin";
import { revalidateStorefront } from "@/server/lib/revalidate";

/** POST /api/v1/admin/categories/reorder — `{ ids }` in their new order. */

export const POST = adminRoute(async (request, { audit }) => {
  const { ids } = await adminBody(request, reorderSchema);
  await reorderCategories(ids);

  await audit({
    action: "category.reorder",
    entityType: "category",
    summary: "ترتیب دسته‌بندی‌ها تغییر کرد",
  });
  revalidateStorefront();

  return ok({ reordered: ids.length });
});
