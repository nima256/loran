"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/Navigation";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { Price, PriceInline } from "@/components/ui/Price";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useToast } from "@/components/ui/Toast";
import { CouponField } from "@/components/cart/CouponField";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { useCart } from "@/store/CartProvider";
import { toPersianDigits } from "@/lib/format";

export default function CartPage() {
  const { items, totals, coupon, hydrating, updateQuantity, removeItem, restoreItem, clear } = useCart();
  const { toast } = useToast();

  const remove = (variantId: string) => {
    const removed = removeItem(variantId);
    if (removed) {
      toast({
        tone: "info",
        title: "کالا از سبد حذف شد",
        description: removed.name,
        action: { label: "بازگردانی", onClick: () => restoreItem(removed) },
      });
    }
  };

  if (hydrating) {
    return (
      <div className="container-page py-8">
        <Skeleton className="mb-6 h-8 w-40" />
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-10">
        <Breadcrumbs className="mb-6" items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />
        <EmptyState
          icon={<ShoppingBag className="size-7" aria-hidden />}
          title="سبد خرید شما خالی است"
          description="هنوز کفشی انتخاب نکرده‌اید. از پرفروش‌ترین‌ها شروع کنید یا کل فروشگاه را ببینید."
          action={<ButtonLink href="/shop">رفتن به فروشگاه</ButtonLink>}
          secondaryAction={<ButtonLink href="/sale" variant="secondary">دیدن تخفیف‌ها</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs className="mb-4" items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">
          سبد خرید
          <span className="tnum ms-2 text-base font-normal text-fg-muted">
            ({toPersianDigits(items.length)} کالا)
          </span>
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("همه کالاها از سبد خرید حذف شوند؟")) clear();
          }}
          icon={<Trash2 className="size-4" aria-hidden />}
          className="text-fg-muted hover:text-danger"
        >
          خالی کردن سبد
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-8">
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.variantId} className="rounded-lg border border-border bg-surface p-3 sm:p-4">
              <div className="flex gap-3 sm:gap-4">
                <Link
                  href={`/product/${item.slug}`}
                  className="relative size-24 shrink-0 overflow-hidden rounded-md bg-surface-inset sm:size-28"
                >
                  <Image src={item.image} alt={item.name} fill sizes="112px" className="object-cover" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${item.slug}`}
                        className="line-clamp-2 text-sm font-medium leading-6 text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]"
                      >
                        {item.name}
                      </Link>
                      {/* The exact variant is always visible — colour and size. */}
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className="size-3.5 rounded-full border border-border" style={{ background: item.colorHex }} />
                          رنگ {item.colorName}
                        </span>
                        <span className="tnum">سایز {toPersianDigits(item.size)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.variantId)}
                      aria-label={`حذف ${item.name} از سبد خرید`}
                      className="grid size-10 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      max={item.maxQuantity}
                      onChange={(q) => updateQuantity(item.variantId, q)}
                      onRemove={() => remove(item.variantId)}
                    />
                    <div className="text-end">
                      {item.quantity > 1 && (
                        <p className="tnum text-xs text-fg-subtle">
                          واحدی <PriceInline value={item.price} muted className="text-xs" />
                        </p>
                      )}
                      <Price
                        value={item.price * item.quantity}
                        compareAt={item.compareAtPrice ? item.compareAtPrice * item.quantity : undefined}
                        size="md"
                        align="end"
                        showBadge={false}
                      />
                    </div>
                  </div>

                  {item.maxQuantity <= 3 && (
                    <p className="tnum mt-2 text-xs text-warning">
                      تنها {toPersianDigits(item.maxQuantity)} عدد از این سایز موجود است.
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}

          <li>
            <ButtonLink
              href="/shop"
              variant="ghost"
              icon={<ArrowLeft className="size-4 rotate-180" aria-hidden />}
              className="text-fg-muted"
            >
              ادامه خرید
            </ButtonLink>
          </li>
        </ul>

        <div className="space-y-4 lg:sticky lg:top-[calc(var(--header-h)+1rem)]">
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <CouponField />
          </div>

          <OrderSummary
            totals={totals}
            couponCode={coupon?.code}
            footer={
              <ButtonLink href="/checkout" size="lg" fullWidth iconEnd={<ArrowLeft className="size-4" aria-hidden />}>
                ادامه و تکمیل خرید
              </ButtonLink>
            }
          />
        </div>
      </div>
    </div>
  );
}
