import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { ShopView } from "@/components/shop/ShopView";
import {
  getCategoryBySlug,
  getFacets,
  listBrands,
  listCategories,
  searchProducts,
} from "@/server/services/catalog";
import { parseFilters, type RawParams } from "@/lib/shop-params";
import { applyContext, categoryContext } from "@/lib/shop-context";

/** Rendered on demand — the listing reflects live stock and prices. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "دسته‌بندی پیدا نشد" };
  return { title: category.name, description: category.description };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const raw = await searchParams;
  const context = categoryContext(category.slug, category.name);
  // The category comes from the route, not the query string — see
  // `lib/shop-context` for why the two are kept from ever disagreeing.
  const filters = applyContext(parseFilters(raw), context);

  const [result, facets, categories, brands] = await Promise.all([
    searchProducts(filters),
    getFacets(),
    listCategories(),
    listBrands(),
  ]);

  return (
    <>
      <div className="container-page pt-5">
        <Breadcrumbs
          items={[
            { label: "خانه", href: "/" },
            { label: "فروشگاه", href: "/shop" },
            { label: category.name },
          ]}
        />
      </div>
      <ShopView
        result={result}
        filters={filters}
        facets={facets}
        categories={categories}
        brands={brands}
        basePath={`/category/${slug}`}
        heading={category.name}
        description={category.description}
        context={context}
      />
    </>
  );
}
