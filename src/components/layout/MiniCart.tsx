"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Drawer } from "@/components/ui/Overlay";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { PriceInline } from "@/components/ui/Price";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useCart } from "@/store/CartProvider";
import { useToast } from "@/components/ui/Toast";
import { formatAmount, toPersianDigits } from "@/lib/format";
import { siteConfig } from "@/lib/site-config";

/** Quick cart review from the header. The full cart page stays the source of truth. */
export function MiniCart() {
  const { items, miniCartOpen, setMiniCartOpen, totals, updateQuantity, removeItem, restoreItem } = useCart();
  const { toast } = useToast();
  const close = () => setMiniCartOpen(false);

  return (
    <Drawer
      open={miniCartOpen}
      onClose={close}
      side="end"
      title={`سبد خرید${items.length ? ` (${toPersianDigits(items.length)} کالا)` : ""}`}
      footer={
        items.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-muted">مبلغ قابل پرداخت</span>
              <PriceInline value={totals.payableOnline} />
            </div>
            <p className="text-xs leading-6 text-fg-muted">{siteConfig.commerce.shippingNoticeShort}</p>
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink href="/cart" variant="secondary" onClick={close}>مشاهده سبد</ButtonLink>
              <ButtonLink href="/checkout" onClick={close}>تکمیل خرید</ButtonLink>
            </div>
          </div>
        ) : null
      }
    >
      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<ShoppingBag className="size-7" aria-hidden />}
            title="سبد خرید شما خالی است"
            description="هنوز کفشی انتخاب نکرده‌اید. از فروشگاه شروع کنید."
            action={<ButtonLink href="/shop" onClick={close}>رفتن به فروشگاه</ButtonLink>}
            className="border-0 bg-transparent py-8"
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.variantId} className="flex gap-3 p-4">
              <Link href={`/product/${item.slug}`} onClick={close} className="relative size-20 shrink-0 overflow-hidden rounded-md bg-surface-inset">
                <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/product/${item.slug}`} onClick={close} className="line-clamp-2 text-sm font-medium text-fg hover:text-primary dark:hover:text-[color:var(--primary-soft-fg)]">
                  {item.name}
                </Link>
                <p className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden className="size-3 rounded-full border border-border" style={{ background: item.colorHex }} />
                    {item.colorName}
                  </span>
                  <span aria-hidden>،</span>
                  <span>سایز {toPersianDigits(item.size)}</span>
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <QuantityStepper
                    size="sm"
                    value={item.quantity}
                    max={item.maxQuantity}
                    onChange={(q) => updateQuantity(item.variantId, q)}
                    onRemove={() => {
                      const removed = removeItem(item.variantId);
                      if (removed) {
                        toast({
                          tone: "info",
                          title: "کالا از سبد حذف شد",
                          action: { label: "بازگردانی", onClick: () => restoreItem(removed) },
                        });
                      }
                    }}
                  />
                  <span className="tnum text-sm font-semibold text-fg">
                    {formatAmount(item.price * item.quantity)}
                    <span className="ms-1 text-[0.6875rem] font-normal text-fg-muted">تومان</span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
