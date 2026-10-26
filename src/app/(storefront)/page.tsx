import { ArrowLeft } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { CollectionGrid } from "@/components/home/CollectionGrid";
import { ProductGrid, ResponsiveProductGrid } from "@/components/product/ProductCard";
import { SectionHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import {
  getBestSellers, getCategorySubtreeCounts, getCategoryCoverImages, getCollectionCoverImages,
  getNewArrivals, getOnSale, listCategories, listCollections,
} from "@/server/services/catalog";
import { TAG_SECTIONS } from "@/lib/catalog-constants";
import { categoryNav } from "@/lib/navigation";
import { toPersianDigits } from "@/lib/format";
import { toProductCardData } from "@/lib/product-card";

/**
 * Homepage.
 *
 * Everything below the hero comes from the database on every request: the
 * categories and collections an administrator manages, and the three product
 * sections fed by the badges they put on products. It must never be
 * prerendered at build time — that is what used to freeze it, so new
 * categories and newly badged products never appeared.
 */
export const dynamic = "force-dynamic";

/** Bundled artwork for the seeded categories, used only when no image was uploaded. */
const CATEGORY_IMAGES: Record<string, string> = {
  sneaker: "/products/sneaker-burgundy-side.svg",
  running: "/products/runner-navy-side.svg",
  casual: "/products/sneaker-cream-side.svg",
  classic: "/products/loafer-brown-side.svg",
  boots: "/products/boot-tan-side.svg",
  loafer: "/products/loafer-black-side.svg",
  sandal: "/products/sandal-tan-side.svg",
  kids: "/products/runner-skyblue-side.svg",
};

export default async function HomePage() {
  const [newArrivals, bestSellers, onSale, allCategories, counts, collections] = await Promise.all([
    getNewArrivals(8),
    getBestSellers(8),
    getOnSale(8),
    listCategories(),
    // Includes subcategories: a parent tile counts everything behind its link.
    getCategorySubtreeCounts(),
    listCollections(),
  ]);

  // «Featured» picks the homepage tiles; with none picked, every visible
  // top-level category shows, so the section can never silently disappear.
  // A featured subcategory under a hidden parent stays hidden.
  const visibleIds = new Set(categoryNav(allCategories).flatMap(function walk(i): string[] {
    return [i.slug, ...i.children.flatMap(walk)];
  }));
  const visible = allCategories.filter((c) => visibleIds.has(c.slug));
  const featured = visible.filter((c) => c.featured);
  const categories = featured.length ? featured : visible.filter((c) => !c.parentId);

  const [categoryCovers, collectionCovers] = await Promise.all([
    getCategoryCoverImages(categories.filter((c) => !c.image && !CATEGORY_IMAGES[c.slug]).map((c) => c.id)),
    getCollectionCoverImages(collections.filter((c) => !c.image).map((c) => c.id)),
  ]);

  const seeAll = (href: string, label = "مشاهده همه") => (
    <ButtonLink href={href} variant="link" size="sm" iconEnd={<ArrowLeft className="size-4" aria-hidden />}>
      {label}
    </ButtonLink>
  );

  return (
    <>
      <Hero />

      {/* Categories sit immediately under the hero so they are reachable near
          the fold on a normal laptop screen. */}
      {categories.length > 0 && (
        <section className="container-page section" aria-labelledby="home-categories">
          <SectionHeader
            id="home-categories"
            title="دسته‌بندی‌ها"
            description="از کجا شروع می‌کنی؟"
            action={seeAll("/shop", "همه محصولات")}
          />
          <CategoryGrid
            categories={categories.map((c) => ({
              ...c,
              image: c.image ?? CATEGORY_IMAGES[c.slug] ?? categoryCovers.get(c.id),
            }))}
            counts={counts}
          />
        </section>
      )}

      {/* Order is fixed: New Arrivals → Best Sellers → Discounted. */}
      {newArrivals.length > 0 && (
        <section className="container-page section render-later" aria-labelledby="home-new">
          <SectionHeader
            id="home-new"
            title={TAG_SECTIONS.new.title}
            description="جدیدترین مدل‌هایی که به فروشگاه اضافه شده‌اند."
            action={seeAll(TAG_SECTIONS.new.href)}
          />
          <ProductGrid products={newArrivals.map(toProductCardData)} />
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="container-page section render-later" aria-labelledby="home-bestsellers">
          <SectionHeader
            id="home-bestsellers"
            title={TAG_SECTIONS.bestseller.title}
            description="مدل‌هایی که مشتری‌های لوران بیشتر از همه انتخاب کرده‌اند."
            action={seeAll(TAG_SECTIONS.bestseller.href)}
          />
          {/* One DOM tree: rail on phones, grid from tablet up. */}
          <ResponsiveProductGrid products={bestSellers.map(toProductCardData)} />
        </section>
      )}

      {/* Sale block: brand colour used as a frame, not smeared over every card. */}
      {onSale.length > 0 && (
        <section className="section render-later bg-surface-3 dark:bg-surface-2" aria-labelledby="home-sale">
          <div className="container-page">
            <SectionHeader
              id="home-sale"
              title={TAG_SECTIONS.sale.title}
              description="قیمت‌های حراج تا پایان موجودی هر سایز معتبر است."
              action={seeAll(TAG_SECTIONS.sale.href)}
            />
            <ResponsiveProductGrid products={onSale.map(toProductCardData)} />
          </div>
        </section>
      )}

      {collections.length > 0 && (
        <section className="container-page section render-later" aria-labelledby="home-collections">
          <SectionHeader
            id="home-collections"
            title="کالکشن‌ها"
            description="هر کالکشن، یک حال‌وهوای متفاوت."
          />
          <CollectionGrid
            collections={collections.map((c) => ({ ...c, image: c.image ?? collectionCovers.get(c.id) }))}
          />
        </section>
      )}

      {/* Structured data so the storefront is indexable from day one. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: "لوران",
            url: "https://loranworld.com",
            image: "https://loranworld.com/brand/loran-logo.png",
            address: { "@type": "PostalAddress", addressLocality: "یزد", addressCountry: "IR" },
          }),
        }}
      />
      <span className="sr-only">{toPersianDigits(categories.length)} دسته‌بندی فعال</span>
    </>
  );
}
