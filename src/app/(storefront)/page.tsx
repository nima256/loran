import { ArrowLeft } from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ValueProps } from "@/components/home/ValueProps";
import { ProductGrid, ResponsiveProductGrid } from "@/components/product/ProductCard";
import { SectionHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import {
  getBestSellers, getCategoryCounts, getNewArrivals, getOnSale, listCategories,
} from "@/server/services/catalog";
import { toPersianDigits } from "@/lib/format";
import { toProductCardData } from "@/lib/product-card";

/** Representative image per category, reusing the product artwork. */
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
  const [bestSellers, onSale, newArrivals, categories, counts] = await Promise.all([
    getBestSellers(8),
    getOnSale(8),
    getNewArrivals(4),
    listCategories(),
    getCategoryCounts(),
  ]);

  const bestSellerCards = bestSellers.map(toProductCardData);
  const onSaleCards = onSale.map(toProductCardData);
  const newArrivalCards = newArrivals.map(toProductCardData);

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
      <section className="container-page section" aria-labelledby="home-categories">
        <SectionHeader
          id="home-categories"
          title="دسته‌بندی‌ها"
          description="از کجا شروع می‌کنی؟"
          action={seeAll("/shop", "همه محصولات")}
        />
        <CategoryGrid
          categories={categories.map((c) => ({ ...c, image: CATEGORY_IMAGES[c.slug] }))}
          counts={counts}
        />
      </section>

      <section className="container-page pb-4" aria-label="مزیت‌های خرید از لوران">
        <ValueProps />
      </section>

      <section className="container-page section render-later" aria-labelledby="home-bestsellers">
        <SectionHeader
          id="home-bestsellers"
          title="پرفروش‌ترین‌ها"
          description="مدل‌هایی که مشتری‌های لوران بیشتر از همه انتخاب کرده‌اند."
          action={seeAll("/shop?sort=bestselling")}
        />
        {/* One DOM tree: rail on phones, grid from tablet up. */}
        <ResponsiveProductGrid products={bestSellerCards} />
      </section>

      {/* Sale block: brand colour used as a frame, not smeared over every card. */}
      <section className="section render-later bg-surface-3 dark:bg-surface-2" aria-labelledby="home-sale">
        <div className="container-page">
          <SectionHeader
            id="home-sale"
            title="بیشترین تخفیف‌ها"
            description="قیمت‌های حراج تا پایان موجودی هر سایز معتبر است."
            action={seeAll("/sale")}
          />
          <ResponsiveProductGrid products={onSaleCards} />
        </div>
      </section>

      <section className="container-page section render-later" aria-labelledby="home-new">
        <SectionHeader
          id="home-new"
          title="تازه رسیده‌ها"
          description="جدیدترین مدل‌هایی که به فروشگاه اضافه شده‌اند."
          action={seeAll("/shop?sort=newest")}
        />
        <ProductGrid products={newArrivalCards} />
      </section>

      {/* Quiet editorial block — story, not another banner. */}
      <section className="container-page pb-12 render-later">
        <div className="grid gap-6 overflow-hidden rounded-xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-10">
          <div>
            <p className="text-sm font-semibold text-primary dark:text-[color:var(--primary-soft-fg)]">از یزد، برای همه ایران</p>
            <h2 className="mt-3 text-xl font-bold leading-9 text-fg sm:text-2xl">
              لوران از یک ویترین کوچک در پاساژ ستاره شروع شد
            </h2>
            <p className="mt-4 text-sm leading-8 text-fg-muted">
              سال‌هاست کفش می‌فروشیم و هر جفتی که در فروشگاه اینترنتی می‌بینید، همان کفشی است که
              در ویترین شعبه‌های ما هم هست. اگر در انتخاب سایز یا مدل شک دارید، قبل از خرید با ما
              حرف بزنید؛ مشاوره سایز رایگان است.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/about" variant="secondary">درباره لوران</ButtonLink>
              <ButtonLink href="/consultation" variant="ghost">درخواست مشاوره سایز</ButtonLink>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { value: "۱۰۰+", label: "مدل موجود" },
              { value: "۳", label: "شعبه حضوری در یزد" },
              { value: "۷ روز", label: "مهلت تعویض" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-surface-3 p-4 text-center dark:bg-surface-2">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="tnum block text-xl font-bold text-fg sm:text-2xl">{stat.value}</span>
                  <span className="mt-1 block text-xs leading-5 text-fg-muted">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

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
      <span className="sr-only">{toPersianDigits(counts.size)} دسته‌بندی فعال</span>
    </>
  );
}
