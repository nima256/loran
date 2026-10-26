import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { archiveProduct, deleteProduct, updateProduct } from "@/server/services/admin-products";
import { revalidateStorefront } from "@/server/lib/revalidate";
import { getProductForAdmin } from "@/server/services/catalog";
import { notFound } from "@/server/lib/errors";
import { productSchema } from "@/server/schemas/admin";

/** GET / PUT / DELETE /api/v1/admin/products/[id] */

type Params = { id: string };

export const GET = adminRoute<Params>(async (_request, { params }) => {
  const row = await getProductForAdmin(params.id);
  if (!row) throw notFound("محصول پیدا نشد.");

  // The editor works in EU size numbers, not Size row ids.
  return ok({
    product: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      subtitle: row.subtitle ?? "",
      brandId: row.brandId,
      categoryIds: row.categories.map((c) => c.categoryId),
      gender: row.gender,
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      description: row.description,
      features: row.features,
      specs: row.specs,
      tags: row.tags,
      active: row.active,
      rating: row.rating,
      reviewCount: row.reviewCount,
      soldCount: row.soldCount,
      colors: row.colors.map((c) => ({
        id: c.id,
        colorId: c.colorId,
        name: c.color.name,
        hex: c.color.hex,
        images: c.images,
      })),
      variants: row.variants.map((v) => ({
        id: v.id,
        colorId: v.colorId,
        size: v.size.value,
        sku: v.sku,
        stock: v.stock,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        active: v.active,
      })),
    },
  });
});

export const PUT = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, productSchema);
  const product = await updateProduct(params.id, input);

  await audit({
    action: "product.update",
    entityType: "product",
    entityId: product.id,
    summary: `محصول «${input.name}» ویرایش شد`,
    meta: { slug: product.slug, variants: input.variants.length, active: input.active },
  });
  revalidateStorefront();

  return ok({ product });
});

/**
 * Deletes a product permanently. `?mode=archive` keeps the old, reversible
 * behaviour (hide it from the storefront) for callers that want it.
 */
export const DELETE = adminRoute<Params>(async (request, { params, audit }) => {
  const archive = new URL(request.url).searchParams.get("mode") === "archive";

  if (archive) {
    const row = await getProductForAdmin(params.id);
    if (!row) throw notFound("محصول پیدا نشد.");
    await archiveProduct(params.id);
    await audit({
      action: "product.archive",
      entityType: "product",
      entityId: params.id,
      summary: `محصول «${row.name}» بایگانی شد`,
    });
    revalidateStorefront();
    return ok({
      archived: true,
      message: "محصول بایگانی شد و از فروشگاه برداشته شد. سابقه سفارش‌های قبلی دست‌نخورده باقی می‌ماند.",
    });
  }

  const deleted = await deleteProduct(params.id);
  await audit({
    action: "product.delete",
    entityType: "product",
    entityId: deleted.id,
    summary: `محصول «${deleted.name}» حذف شد`,
    meta: { slug: deleted.slug, orderItems: deleted.orderItems, deletedImages: deleted.deletedImages },
  });
  revalidateStorefront();

  return ok({
    deleted: true,
    message:
      deleted.orderItems > 0
        ? "محصول حذف شد. سفارش‌های قبلی با اطلاعات ذخیره‌شده در خود سفارش، بدون تغییر نمایش داده می‌شوند."
        : "محصول حذف شد.",
  });
});
