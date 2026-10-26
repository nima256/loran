"use client";

import { useEffect, useRef, useState } from "react";
import { useSwipe } from "@/lib/use-swipe";
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
 * the second photo and a soft lift on pointer devices; on touch, the photos of
 * the selected colour can be swiped through.
 *
 * Swiping is switched off when the card sits in a horizontally scrolling rail
 * (the homepage sections on phones): there a sideways drag must scroll the
 * rail, and two competing horizontal gestures would make both unreliable.
 */

/** True when an ancestor scrolls horizontally — a rail. */
function inHorizontalScroller(el: HTMLElement): boolean {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollWidth > node.clientWidth + 1) return true;
  }
  return false;
}
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
  const [imageIndex, setImageIndex] = useState(0);
  const [inRail, setInRail] = useState(false);
  const imageRef = useRef<HTMLAnchorElement>(null);
  const color = product.colors[activeColor] ?? product.colors[0];
  const images = color.images;
  const swipeable = images.length > 1 && !inRail;
  const swipe = useSwipe({ count: swipeable ? images.length : 0, index: imageIndex, onChange: setImageIndex });

  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;
    const check = () => setInRail(inHorizontalScroller(el));
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Stock is summed from the variants of the selected colourway only.
  const colorStock = product.variants
    .filter((v) => v.colorId === color.id)
    .reduce((n, v) => n + v.stock, 0);

  const lowStock = colorStock > 0 && colorStock <= 3;
  const isNew = product.tags.includes("new");
  const isBestseller = product.tags.includes("bestseller");
  const isSale = product.tags.includes("sale");
  // A product can carry several badges; the card shows at most two, the
  // discount (or «حراج») first.
  const badges = [
    product.discountPercent > 0
      ? { key: "discount", tone: "sale" as const, label: `${toPersianDigits(product.discountPercent)}٪ تخفیف` }
      : isSale ? { key: "sale", tone: "sale" as const, label: "حراج" } : null,
    isNew ? { key: "new", tone: "brand" as const, label: "جدید" } : null,
    isBestseller ? { key: "bestseller", tone: "neutral" as const, label: "پرفروش" } : null,
  ].filter((b): b is NonNullable<typeof b> => b !== null).slice(0, 2);
  const colorCount = product.colorCount ?? product.colors.length;

  return (
    <article
      onPointerEnter={(e) => e.pointerType === "mouse" && color.images[1] && setShowAlternate(true)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface",
        "transition-[border-color,box-shadow,transform] duration-[--dur-base] ease-[--ease-out]",
        "hover:border-border-strong hover:shadow-e2 focus-within:border-border-strong",
        "motion-safe:hover:-translate-y-0.5",
        className
      )}
    >
      {/* The image is its own (duplicate, unfocusable) link, raised above the
          card's stretched link so it can own the swipe gesture. */}
      <Link
        ref={imageRef}
        href={`/product/${product.slug}`}
        tabIndex={-1}
        aria-hidden
        draggable={false}
        onClickCapture={swipe.suppressClickAfterSwipe}
        className="relative z-[1] block aspect-square select-none overflow-hidden bg-surface-inset [-webkit-touch-callout:none]"
        {...(swipeable ? swipe.bind : {})}
      >
        <div className="flex h-full motion-reduce:transition-none!" style={swipeable ? swipe.trackStyle : undefined}>
          {images.map((src, i) => (
            <div key={src} className="relative h-full w-full shrink-0">
              {/* Only the frame on screen and its neighbour are loaded. */}
              {(i === 0 || (swipeable && Math.abs(i - imageIndex) <= 1)) && (
                <Image
                  src={src} unoptimized={isLocalUpload(src)}
                  alt={i === 0 ? `${product.name} — رنگ ${color.name}` : ""}
                  fill
                  sizes={sizes}
                  priority={priority && i === 0}
                  draggable={false}
                  className="pointer-events-none object-cover"
                />
              )}
            </div>
          ))}
        </div>
        {color.images[1] && showAlternate && imageIndex === 0 && (
          <Image
            src={color.images[1]} unoptimized={isLocalUpload(color.images[1])}
            alt=""
            fill
            sizes={sizes}
            aria-hidden
            className="object-cover opacity-0 transition-opacity duration-[--dur-slow] group-hover:opacity-100"
          />
        )}

        {swipeable && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {images.map((src, i) => (
              <span
                key={src}
                className={cn(
                  "h-1.5 rounded-full bg-white/90 shadow-e1 transition-[width,opacity] duration-[--dur-base]",
                  i === imageIndex ? "w-4 opacity-100" : "w-1.5 opacity-60"
                )}
              />
            ))}
          </div>
        )}

        {/* Badges — at most two so the photo stays the subject. */}
        <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
          {badges.map((badge) => (
            <Badge key={badge.key} tone={badge.tone} size="sm" className="tnum shadow-e1">
              {badge.label}
            </Badge>
          ))}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 grid place-items-center bg-surface/70 backdrop-blur-[1px]">
            <span className="rounded-md bg-surface px-3 py-1.5 text-sm font-semibold text-fg-muted shadow-e1">
              ناموجود
            </span>
          </div>
        )}
      </Link>

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
                onClick={() => { setActiveColor(i); setShowAlternate(false); setImageIndex(0); }}
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
