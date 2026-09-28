"use client";

import { useState } from "react";
import Image from "next/image";
import { isLocalUpload } from "@/lib/media";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { RatingSummary } from "@/components/ui/Rating";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/product-card";

/**
 * The product card used in every grid on the site.
 *
 * Nothing essential is hover-only: the colour swatches, price, stock state and
 * the link to the product page are all present on touch devices. Hover just adds
 * the second photo and a soft lift on pointer devices.
 */
export function ProductCard({
  product,
  priority,
  className,
  sizes = "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 47vw",
}: {
  product: ProductCardData;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const [activeColor, setActiveColor] = useState(0);
  const [showAlternate, setShowAlternate] = useState(false);
  const color = product.colors[activeColor] ?? product.colors[0];

  // Stock is summed from the variants of the selected colourway only.
  const colorStock = product.variants
    .filter((v) => v.colorId === color.id)
    .reduce((n, v) => n + v.stock, 0);

  const lowStock = colorStock > 0 && colorStock <= 3;
  const isNew = product.tags.includes("new");
  const isBestseller = product.tags.includes("bestseller");
  const colorCount = product.colorCount ?? product.colors.length;

  return (
    <article
      onPointerEnter={() => color.images[1] && setShowAlternate(true)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface",
        "transition-[border-color,box-shadow,transform] duration-[--dur-base] ease-[--ease-out]",
        "hover:border-border-strong hover:shadow-e2 focus-within:border-border-strong",
        "motion-safe:hover:-translate-y-0.5",
        className
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-surface-inset">
        <Image
          src={color.images[0]} unoptimized={isLocalUpload(color.images[0])}
          alt={`${product.name} — رنگ ${color.name}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
        {color.images[1] && showAlternate && (
          <Image
            src={color.images[1]} unoptimized={isLocalUpload(color.images[1])}
            alt=""
            fill
            sizes={sizes}
            aria-hidden
            className="object-cover opacity-0 transition-opacity duration-[--dur-slow] group-hover:opacity-100"
          />
        )}

        {/* Badges — at most two so the photo stays the subject. */}
        <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
          {product.discountPercent > 0 && (
            <Badge tone="sale" size="sm" className="tnum shadow-e1">
              {toPersianDigits(product.discountPercent)}٪ تخفیف
            </Badge>
          )}
          {!product.discountPercent && isNew && <Badge tone="brand" size="sm">جدید</Badge>}
          {!product.discountPercent && !isNew && isBestseller && <Badge tone="neutral" size="sm">پرفروش</Badge>}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 grid place-items-center bg-surface/70 backdrop-blur-[1px]">
            <span className="rounded-md bg-surface px-3 py-1.5 text-sm font-semibold text-fg-muted shadow-e1">
              ناموجود
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="text-xs text-fg-subtle">{product.brandName}</p>

        <h3 className="text-sm font-medium leading-6 text-fg">
          <Link
            href={`/product/${product.slug}`}
            // Stretched link: the whole card is the target, but the swatches
            // below sit above it so they stay independently clickable.
            className="line-clamp-2 before:absolute before:inset-0 before:content-[''] hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
          >
            {product.name}
          </Link>
        </h3>

        {product.reviewCount > 0 && (
          <RatingSummary value={product.rating} count={product.reviewCount} size="sm" className="text-xs" />
        )}

        {colorCount > 1 && (
          <div className="relative z-10 flex flex-wrap items-center gap-1.5">
            {product.colors.slice(0, 5).map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setActiveColor(i); setShowAlternate(false); }}
                aria-label={`نمایش رنگ ${c.name}`}
                aria-pressed={i === activeColor}
                title={c.name}
                // 24px hit area with a 16px visible dot keeps the swatch row
                // tidy without dropping below the minimum target size.
                className="grid size-6 place-items-center rounded-full"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-4 rounded-full border transition-[box-shadow,border-color]",
                    i === activeColor
                      ? "border-fg ring-2 ring-fg/20 ring-offset-1 ring-offset-surface"
                      : "border-border group-hover:border-fg-subtle"
                  )}
                  style={{ background: c.hex }}
                />
              </button>
            ))}
            {colorCount > 5 && (
              <span className="tnum text-xs text-fg-subtle">+{toPersianDigits(colorCount - 5)}</span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price value={product.price} compareAt={product.compareAtPrice} size="sm" showBadge={false} />
          {lowStock && <span className="text-xs font-medium text-warning">تنها {toPersianDigits(colorStock)} عدد</span>}
        </div>
      </div>
    </article>
  );
}

/** Responsive product grid — two columns on phones, four on large screens. */
export function ProductGrid({
  products, className, priorityCount = 0,
}: { products: ProductCardData[]; className?: string; priorityCount?: number }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < priorityCount} />
      ))}
    </div>
  );
}

/** Horizontal scroller used for "related products" and homepage rails on mobile. */
export function ProductRail({ products }: { products: ProductCardData[] }) {
  return (
    <div className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          className="w-[calc(50%-0.75rem)] min-w-[9.5rem] sm:w-56"
          sizes="(min-width: 640px) 224px, 45vw"
        />
      ))}
    </div>
  );
}


/**
 * Homepage-friendly product list: one DOM tree that is a horizontal rail on
 * phones and becomes the regular grid from the sm breakpoint upward.
 *
 * This avoids rendering every product twice (mobile + desktop) and merely
 * hiding one copy with CSS, which was inflating DOM size and hydration work.
 */
export function ResponsiveProductGrid({
  products, className, priorityCount = 0,
}: { products: ProductCardData[]; className?: string; priorityCount?: number }) {
  return (
    <div
      className={cn("product-showcase", className)}
    >
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={i < priorityCount}
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 45vw"
        />
      ))}
    </div>
  );
}
