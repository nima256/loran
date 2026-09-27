import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createCategory } from "@/server/services/taxonomy";
import { listCategories, getCategoryCounts } from "@/server/services/catalog";
import { categorySchema } from "@/server/schemas/admin";

/** GET / POST /api/v1/admin/categories */

export const GET = adminRoute(async () => {
  const [categories, counts] = await Promise.all([
    listCategories({ includeInactive: true }),
    getCategoryCounts(),
  ]);
  return ok({
    categories: categories.map((c) => ({ ...c, productCount: counts.get(c.id) ?? 0 })),
  });
});

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, categorySchema);
  const category = await createCategory(input);

  await audit({
    action: "category.create",
    entityType: "category",
    entityId: category.id,
    summary: `دسته‌بندی «${category.name}» ایجاد شد`,
  });

  return created({ category });
});
