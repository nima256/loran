import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { archiveProduct, updateProduct } from "@/server/services/admin-products";
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

  return ok({ product });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  const row = await getProductForAdmin(params.id);
  if (!row) throw notFound("محصول پیدا نشد.");

  await archiveProduct(params.id);
  await audit({
    action: "product.archive",
    entityType: "product",
    entityId: params.id,
    summary: `محصول «${row.name}» بایگانی شد`,
  });

  return ok({
    archived: true,
    // Said plainly, because "delete" did not delete anything.
    message:
      "محصول بایگانی شد و از فروشگاه برداشته شد. سابقه سفارش‌های قبلی دست‌نخورده باقی می‌ماند.",
  });
});
