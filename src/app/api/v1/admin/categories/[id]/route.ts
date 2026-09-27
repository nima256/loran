import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteCategory, updateCategory } from "@/server/services/taxonomy";
import { categorySchema } from "@/server/schemas/admin";

/** PATCH / DELETE /api/v1/admin/categories/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, categorySchema.partial());
  const category = await updateCategory(params.id, input);

  await audit({
    action: "category.update",
    entityType: "category",
    entityId: category.id,
    summary: `دسته‌بندی «${category.name}» ویرایش شد`,
    meta: input as Record<string, unknown>,
  });

  return ok({ category });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  // The service decides between delete and deactivate based on what points at
  // the category; the response tells the administrator which happened.
  const result = await deleteCategory(params.id);

  await audit({
    action: result.action === "deleted" ? "category.delete" : "category.archive",
    entityType: "category",
    entityId: params.id,
    summary: result.message,
  });

  return ok(result);
});
