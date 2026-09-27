import { notFound } from "next/navigation";
import { ProductEditor, type ProductDraft } from "@/components/admin/ProductEditor";
import { getProductForAdmin } from "@/server/services/catalog";
import { getProductEditorOptions } from "@/server/services/taxonomy";

/** Admin → Products → Edit. */

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [row, options] = await Promise.all([
    getProductForAdmin(decodeURIComponent(slug)),
    getProductEditorOptions(),
  ]);
  if (!row) notFound();

  // The editor works in EU size numbers, not Size row ids.
  const initial: ProductDraft = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subtitle: row.subtitle ?? "",
    brandId: row.brandId,
    categoryIds: row.categories.map((c) => c.categoryId),
    gender: row.gender,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    description: row.description,
    features: row.features,
    specs: (row.specs as { label: string; value: string }[]) ?? [],
    tags: row.tags,
    active: row.active,
    colors: row.colors.map((c) => ({ colorId: c.colorId, images: c.images })),
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
  };

  return <ProductEditor initial={initial} options={options} mode="edit" />;
}
