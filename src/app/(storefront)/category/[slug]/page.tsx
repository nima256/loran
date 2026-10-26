import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { ShopView } from "@/components/shop/ShopView";
import Link from "next/link";
import {
  getCategoryBySlug,
  getCategoryFamily,
  getCategorySubtreeCounts,
  getFacets,
  listBrands,
  listCategories,
  searchProducts,
} from "@/server/services/catalog";
import { parseFilters, type RawParams } from "@/lib/shop-params";
import { applyContext, categoryContext } from "@/lib/shop-context";
import { toPersianDigits } from "@/lib/format";

/** Rendered on demand — the listing reflects live stock and prices. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(decodeURIComponent(slug));
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
  const family = await getCategoryFamily(decodeURIComponent(slug));
  if (!family) notFound();
  const { category, ancestors, children } = family;

  const raw = await searchParams;
  const context = categoryContext(category.slug, category.name);
  // The category comes from the route, not the query string — see
  // `lib/shop-context` for why the two are kept from ever disagreeing.
  const filters = applyContext(parseFilters(raw), context);

  const [result, facets, categories, brands, counts] = await Promise.all([
    searchProducts(filters),
    getFacets(),
    listCategories(),
    listBrands(),
    children.length ? getCategorySubtreeCounts() : Promise.resolve(new Map<string, number>()),
  ]);

  return (
    <>
      <div className="container-page pt-5">
        <Breadcrumbs
          items={[
            { label: "خانه", href: "/" },
            { label: "فروشگاه", href: "/shop" },
            ...ancestors.map((a) => ({ label: a.name, href: `/category/${a.slug}` })),
            { label: category.name },
          ]}
        />
        {/* Subcategories: this page already lists their products too; the
            chips narrow it down to one of them. */}
        {children.length > 0 && (
          <nav aria-label={`زیردسته‌های ${category.name}`} className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/category/${child.slug}`}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm text-fg transition-colors hover:border-primary hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
              >
                {child.name}
                <span className="tnum text-xs text-fg-subtle">{toPersianDigits(counts.get(child.id) ?? 0)}</span>
              </Link>
            ))}
          </nav>
        )}
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
