import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, Accordion } from "@/components/ui/Navigation";
import { SectionHeader } from "@/components/ui/Card";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { Reviews } from "@/components/product/Reviews";
import { ProductRail } from "@/components/product/ProductCard";
import {
  getProduct, getRelatedProducts, listCategories,
} from "@/server/services/catalog";
import { getProductReviews, getRatingBreakdown } from "@/server/services/reviews";
import { siteConfig } from "@/lib/site-config";
import { toPersianDigits } from "@/lib/format";

/**
 * Rendered on demand, never prerendered.
 *
 * Stock and price change constantly; a statically generated product page would
 * happily show a sold-out size as available until the next deploy. It also
 * keeps `next build` from needing a reachable database, which matters because
 * the build runs on the operator's machine rather than in production.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(decodeURIComponent(slug));
  if (!product) return { title: "محصول پیدا نشد" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: { images: [{ url: product.colors[0].images[0] }] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Slugs are ASCII, but decode defensively so a hand-typed or re-encoded URL
  // still resolves instead of 404-ing.
  const product = await getProduct(decodeURIComponent(slug));
  if (!product) notFound();

  const [reviews, related, breakdown, categories] = await Promise.all([
    getProductReviews(product.id),
    getRelatedProducts(product, 8),
    getRatingBreakdown(product.id, product.rating),
    listCategories(),
  ]);
  const category = categories.find((c) => c.id === product.categoryIds[0]);

  return (
    <div className="container-page py-5 lg:py-8">
      <Breadcrumbs
        className="mb-5"
        items={[
          { label: "خانه", href: "/" },
          { label: "فروشگاه", href: "/shop" },
          ...(category ? [{ label: category.name, href: `/category/${category.slug}` }] : []),
          { label: product.name },
        ]}
      />

      <ProductPurchase product={product} />

      {/* Details — an accordion so the page stays short and scannable on mobile */}
      <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10">
        <div className="min-w-0">
          <Accordion
            defaultOpen="description"
            items={[
              {
                id: "description",
                title: "معرفی محصول",
                content: (
                  <div className="space-y-4">
                    <p className="leading-8">{product.description}</p>
                    {product.features.length > 0 && (
                      <ul className="space-y-2">
                        {product.features.map((feature) => (
                          <li key={feature} className="flex gap-2">
                            <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              },
              {
                id: "specs",
                title: "مشخصات فنی",
                content: (
                  <dl className="divide-y divide-border">
                    {product.specs.map((spec) => (
                      <div key={spec.label} className="flex items-baseline justify-between gap-4 py-2.5">
                        <dt className="shrink-0 text-fg-subtle">{spec.label}</dt>
                        <dd className="text-end text-fg">{spec.value}</dd>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="shrink-0 text-fg-subtle">رنگ‌بندی موجود</dt>
                      <dd className="text-end text-fg">{product.colors.map((c) => c.name).join("، ")}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="shrink-0 text-fg-subtle">بازه سایز</dt>
                      <dd className="tnum text-end text-fg">
                        {toPersianDigits(Math.min(...product.variants.map((v) => v.size)))} تا{" "}
                        {toPersianDigits(Math.max(...product.variants.map((v) => v.size)))}
                      </dd>
                    </div>
                  </dl>
                ),
              },
              {
                id: "shipping",
                title: "ارسال و تحویل",
                content: (
                  <div className="space-y-3">
                    <p className="leading-8">
                      سفارش‌ها پس از تأیید، طی یک روز کاری آماده و تحویل تیپاکس می‌شوند. زمان رسیدن
                      مرسوله بسته به شهر مقصد، معمولاً ۲ تا ۴ روز کاری است.
                    </p>
                    <p className="leading-8 text-warning">{siteConfig.commerce.shippingNoticeShort}</p>
                    <Link href="/shipping" className="inline-flex min-h-9 items-center text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                      جزئیات کامل شیوه‌های ارسال
                    </Link>
                  </div>
                ),
              },
              {
                id: "returns",
                title: "مرجوعی و تعویض",
                content: (
                  <div className="space-y-3">
                    <p className="leading-8">
                      تا {toPersianDigits(siteConfig.commerce.returnWindowDays)} روز پس از تحویل، در صورتی
                      که کفش استفاده نشده و بسته‌بندی آن سالم باشد، امکان تعویض سایز یا مرجوع کردن کالا
                      وجود دارد.
                    </p>
                    <Link href="/returns" className="inline-flex min-h-9 items-center text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                      شرایط کامل مرجوعی و تعویض
                    </Link>
                  </div>
                ),
              },
            ]}
          />
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:self-start">
          <div className="rounded-lg border border-border bg-surface-2 p-5">
            <h2 className="font-bold text-fg">در انتخاب سایز مطمئن نیستید؟</h2>
            <p className="mt-2 text-sm leading-7 text-fg-muted">
              شماره پا و مدل موردنظرتان را برای ما بفرستید؛ کارشناس لوران سایز مناسب را پیشنهاد می‌دهد.
              مشاوره رایگان است.
            </p>
            <Link
              href="/consultation"
              className="mt-4 inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-3"
            >
              درخواست مشاوره سایز
            </Link>
          </div>
        </aside>
      </div>

      <div className="mt-12 lg:mt-16">
        <Reviews
          productId={product.id}
          productName={product.name}
          reviews={reviews}
          breakdown={breakdown}
          fallbackRating={product.rating}
        />
      </div>

      {related.length > 0 && (
        <section className="mt-12 lg:mt-16" aria-labelledby="related-title">
          <SectionHeader id="related-title" title="محصولات مشابه" description="مدل‌هایی که ممکن است بیشتر بپسندید." />
          <ProductRail products={related} />
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            image: product.colors[0].images,
            description: product.description,
            brand: { "@type": "Brand", name: product.brandName },
            aggregateRating: product.reviewCount
              ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount }
              : undefined,
            offers: {
              "@type": "Offer",
              priceCurrency: "IRT",
              price: product.price,
              availability: product.inStock
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            },
          }),
        }}
      />
    </div>
  );
}
