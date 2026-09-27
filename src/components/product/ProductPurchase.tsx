"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Heart, RefreshCw, Ruler, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { RatingSummary } from "@/components/ui/Rating";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { ProductGallery } from "./ProductGallery";
import { SizeGuideModal } from "./SizeGuideModal";
import { useCart } from "@/store/CartProvider";
import { formatAmount, toPersianDigits } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types";

/**
 * Gallery + buy box.
 *
 * Stock is resolved per variant — the (colour × size) pair. A size that is out
 * of stock in the selected colour is shown, struck through and disabled, never
 * hidden: the customer needs to know it exists but is unavailable, and the UI
 * must never look purchasable when it isn't.
 */
export function ProductPurchase({ product }: { product: ProductSummary }) {
  const { addItem, setMiniCartOpen } = useCart();
  const { toast } = useToast();

  const [colorId, setColorId] = useState(product.colors[0].id);
  const [size, setSize] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // The sticky mobile bar is a fallback for when the real buy button has
  // scrolled away — showing it on arrival would just cover the product.
  const buyRowRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const node = buyRowRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only once the buy row has scrolled *above* the viewport. Before the
        // user reaches it, it is also "not intersecting" — showing the bar then
        // would just cover the product they are still looking at.
        setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const color = product.colors.find((c) => c.id === colorId) ?? product.colors[0];

  /** Every size this product comes in, with availability for the chosen colour. */
  const sizes = useMemo(() => {
    const all = [...new Set(product.variants.map((v) => v.size))].sort((a, b) => a - b);
    return all.map((value) => {
      const variant = product.variants.find((v) => v.colorId === colorId && v.size === value);
      return { value, stock: variant?.stock ?? 0, variantId: variant?.id };
    });
  }, [product.variants, colorId]);

  const selected = size != null ? sizes.find((s) => s.value === size) : undefined;
  const selectedVariant = selected?.variantId
    ? product.variants.find((v) => v.id === selected.variantId)
    : undefined;

  const colorStock = sizes.reduce((n, s) => n + s.stock, 0);
  const colorSoldOut = colorStock === 0;

  const price = selectedVariant?.price ?? product.price;
  const compareAt = selectedVariant?.compareAtPrice ?? product.compareAtPrice;

  /** Switching colour clears a size that doesn't exist in the new colourway. */
  const changeColor = (id: string) => {
    setColorId(id);
    setSizeError(false);
    const stillAvailable = product.variants.some((v) => v.colorId === id && v.size === size && v.stock > 0);
    if (!stillAvailable) setSize(null);
    setQuantity(1);
  };

  const addToCart = () => {
    if (size == null || !selected?.variantId || selected.stock === 0) {
      setSizeError(true);
      document.getElementById("size-picker")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    addItem({
      productId: product.id,
      variantId: selected.variantId,
      slug: product.slug,
      name: product.name,
      image: color.images[0],
      colorId: color.id,
      colorName: color.name,
      colorHex: color.hex,
      size,
      price,
      compareAtPrice: compareAt,
      quantity,
      maxQuantity: selected.stock,
    });
    toast({
      tone: "success",
      title: "به سبد خرید اضافه شد",
      description: `${product.name} — ${color.name}، سایز ${toPersianDigits(size)}`,
      action: { label: "مشاهده سبد", onClick: () => setMiniCartOpen(true) },
    });
  };

  const stockMessage = () => {
    if (colorSoldOut) return { tone: "danger" as const, text: `رنگ ${color.name} در همه سایزها ناموجود است.` };
    if (!selected) return null;
    if (selected.stock === 0) return { tone: "danger" as const, text: `سایز ${toPersianDigits(size!)} در رنگ ${color.name} موجود نیست.` };
    if (selected.stock <= 3) return { tone: "warning" as const, text: `تنها ${toPersianDigits(selected.stock)} عدد از این سایز باقی مانده است.` };
    return { tone: "success" as const, text: "موجود در انبار — آماده ارسال" };
  };
  const stock = stockMessage();
  const canAdd = !!selected && selected.stock > 0;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-10">
        <ProductGallery
          images={color.images}
          alt={`${product.name} — رنگ ${color.name}`}
          badge={
            <>
              {product.discountPercent > 0 && (
                <Badge tone="sale" className="tnum shadow-e1">{toPersianDigits(product.discountPercent)}٪ تخفیف</Badge>
              )}
              {product.tags.includes("new") && <Badge tone="brand">جدید</Badge>}
              {product.tags.includes("limited") && <Badge tone="neutral">تعداد محدود</Badge>}
            </>
          }
        />

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-fg-muted">{product.brandName}</p>
              <h1 className="mt-1.5 text-xl font-bold leading-9 text-fg sm:text-2xl">{product.name}</h1>
            </div>
            <button
              type="button"
              aria-pressed={saved}
              aria-label={saved ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
              onClick={() => {
                setSaved((v) => !v);
                toast({ tone: "info", title: saved ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد" });
              }}
              className="grid size-11 shrink-0 place-items-center rounded-md border border-border text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <Heart className={cn("size-5", saved && "fill-primary text-primary")} aria-hidden />
            </button>
          </div>
          {product.subtitle && <p className="mt-1.5 text-sm text-fg-muted">{product.subtitle}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {product.reviewCount > 0 ? (
              <a href="#reviews" className="rounded-md hover:opacity-80">
                <RatingSummary value={product.rating} count={product.reviewCount} />
              </a>
            ) : (
              <span className="text-sm text-fg-subtle">هنوز دیدگاهی ثبت نشده</span>
            )}
            <span className="tnum text-sm text-fg-subtle">{toPersianDigits(product.soldCount)} فروش</span>
          </div>

          <div className="mt-5 border-y border-border py-5">
            <Price value={price} compareAt={compareAt} size="xl" />
            {compareAt && compareAt > price && (
              <p className="tnum mt-2 text-sm text-success">
                {formatAmount(compareAt - price)} تومان سود شما از این خرید
              </p>
            )}
          </div>

          {/* Colour */}
          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-medium text-fg">
              رنگ: <span className="text-fg-muted">{color.name}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => {
                const active = c.id === colorId;
                const soldOut = !product.variants.some((v) => v.colorId === c.id && v.stock > 0);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => changeColor(c.id)}
                    aria-pressed={active}
                    aria-label={`رنگ ${c.name}${soldOut ? " (ناموجود)" : ""}`}
                    title={c.name}
                    className={cn(
                      "relative grid size-12 place-items-center rounded-md border-2 transition-colors",
                      active ? "border-primary" : "border-border hover:border-border-strong"
                    )}
                  >
                    <span aria-hidden className="size-8 rounded-full border border-black/10" style={{ background: c.hex }} />
                    {soldOut && (
                      <span aria-hidden className="absolute inset-0 grid place-items-center">
                        <span className="h-px w-10 rotate-45 bg-fg-subtle" />
                      </span>
                    )}
                    {active && !soldOut && (
                      <Check className="absolute size-4 text-white mix-blend-difference" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Size */}
          <fieldset className="mt-6" id="size-picker">
            <div className="mb-3 flex items-center justify-between gap-3">
              <legend className="text-sm font-medium text-fg">
                سایز{size != null && <span className="text-fg-muted">: {toPersianDigits(size)}</span>}
              </legend>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex min-h-9 items-center gap-1.5 text-sm text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]"
              >
                <Ruler className="size-4" aria-hidden />
                راهنمای سایز
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {sizes.map(({ value, stock: variantStock }) => {
                const unavailable = variantStock === 0;
                const active = value === size;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={unavailable}
                    aria-pressed={active}
                    aria-label={`سایز ${toPersianDigits(value)}${unavailable ? " — ناموجود" : ""}`}
                    onClick={() => { setSize(value); setSizeError(false); setQuantity(1); }}
                    className={cn(
                      "tnum relative grid h-12 min-w-12 place-items-center rounded-md border px-2 text-sm font-medium transition-colors",
                      unavailable
                        ? "cursor-not-allowed border-border bg-surface-2 text-fg-subtle"
                        : active
                          ? "border-primary bg-primary text-primary-fg"
                          : "border-border-strong bg-surface text-fg hover:border-fg-subtle"
                    )}
                  >
                    {toPersianDigits(value)}
                    {unavailable && (
                      <span aria-hidden className="absolute inset-0 grid place-items-center">
                        <span className="h-px w-9 rotate-[-28deg] bg-fg-subtle/70" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {sizeError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                برای افزودن به سبد، ابتدا یک سایز موجود انتخاب کنید.
              </p>
            )}
            <p className="mt-2 text-xs text-fg-subtle">سایزهای خط‌خورده در این رنگ موجود نیستند.</p>
          </fieldset>

          {stock && (
            <p
              className={cn(
                "mt-4 flex items-center gap-2 text-sm font-medium",
                stock.tone === "success" && "text-success",
                stock.tone === "warning" && "text-warning",
                stock.tone === "danger" && "text-danger"
              )}
              aria-live="polite"
            >
              <span aria-hidden className="size-2 rounded-full bg-current" />
              {stock.text}
            </p>
          )}

          {/* Buy row */}
          <div ref={buyRowRef} className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper
              value={quantity}
              max={selected?.stock || 1}
              onChange={setQuantity}
              disabled={!canAdd}
            />
            <Button
              size="lg"
              onClick={addToCart}
              disabled={colorSoldOut}
              icon={<ShoppingBag className="size-5" aria-hidden />}
              className="flex-1"
            >
              {colorSoldOut ? "این رنگ ناموجود است" : "افزودن به سبد خرید"}
            </Button>
          </div>

          {colorSoldOut && (
            <Alert tone="warning" className="mt-4" title="رنگ دیگری را امتحان کنید">
              این رنگ فعلاً موجود نیست. رنگ‌های دیگر همین مدل ممکن است در سایز شما موجود باشند.
            </Alert>
          )}

          {/* Service promises */}
          <ul className="mt-6 space-y-3 rounded-lg border border-border bg-surface-2 p-4">
            {[
              { icon: Truck, title: "ارسال با تیپاکس", body: siteConfig.commerce.shippingNoticeShort },
              { icon: RefreshCw, title: `${toPersianDigits(siteConfig.commerce.returnWindowDays)} روز مهلت تعویض`, body: "اگر سایز مناسب نبود، طبق شرایط مرجوعی تعویض می‌شود.", href: "/returns" },
              { icon: ShieldCheck, title: "ضمانت اصالت", body: "همان کالایی که در شعبه‌های لوران عرضه می‌شود." },
            ].map(({ icon: Icon, title, body, href }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-fg-subtle" aria-hidden />
                <div className="text-sm">
                  <p className="font-medium text-fg">{title}</p>
                  <p className="mt-0.5 leading-6 text-fg-muted">
                    {body}
                    {href && (
                      <Link href={href} className="ms-1 text-primary hover:underline dark:text-[color:var(--primary-soft-fg)]">
                        جزئیات
                      </Link>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky mobile purchase bar — appears once the buy box is scrolled past. */}
      <div
        aria-hidden={!showStickyBar}
        className={cn(
          "fixed inset-x-0 border-t border-border bg-surface/95 p-3 pb-safe backdrop-blur-md lg:hidden",
          "transition-[opacity,transform] duration-[--dur-base] ease-[--ease-out]",
          showStickyBar ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        )}
        style={{ zIndex: "var(--z-sticky)", bottom: "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Price value={price} compareAt={compareAt} size="sm" showBadge={false} />
            {size != null && (
              <p className="tnum truncate text-xs text-fg-subtle">{color.name}، سایز {toPersianDigits(size)}</p>
            )}
          </div>
          <Button
            onClick={addToCart}
            disabled={colorSoldOut}
            tabIndex={showStickyBar ? undefined : -1}
            icon={<ShoppingBag className="size-4" aria-hidden />}
          >
            {colorSoldOut ? "ناموجود" : "افزودن به سبد"}
          </Button>
        </div>
      </div>
      {/* Reserves space so the sticky bar never covers the page's last element. */}
      <div aria-hidden className={cn("lg:hidden", showStickyBar ? "h-20" : "h-0")} />

      <SizeGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
