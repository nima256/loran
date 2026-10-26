"use client";

import { useState } from "react";
import { Check, TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatAmount } from "@/lib/format";
import { useCart } from "@/store/CartProvider";
import { cn } from "@/lib/utils";

/**
 * Discount-code field with all four states: idle, checking, applied, invalid.
 * The applied state shows what the code is actually worth, not just that it
 * worked.
 */
export function CouponField({ className }: { className?: string }) {
  const { coupon, couponState, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");

  if (coupon && couponState.status === "applied") {
    return (
      <div className={cn("rounded-lg border border-success/30 bg-success-soft p-3", className)}>
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">
              کد «<span dir="ltr" className="break-token">{coupon.code}</span>» اعمال شد
            </p>
            <p className="mt-0.5 text-xs leading-6 text-fg-muted">{coupon.description}</p>
            <p className="tnum mt-1 text-sm font-medium text-success">
              {formatAmount(couponState.discount)} تومان تخفیف
            </p>
          </div>
          <button
            type="button"
            onClick={() => { removeCoupon(); setCode(""); }}
            aria-label="حذف کد تخفیف"
            className="grid size-9 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-surface hover:text-danger"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const invalid = couponState.status === "invalid";

  return (
    <form
      className={className}
      onSubmit={(e) => { e.preventDefault(); if (code.trim()) applyCoupon(code); }}
    >
      <label htmlFor="coupon-code" className="mb-1.5 block text-sm font-medium text-fg">کد تخفیف</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <TicketPercent className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-fg-subtle" aria-hidden />
          <input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="مثلاً LORAN10"
            dir="ltr"
            autoComplete="off"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "coupon-error" : undefined}
            className={cn(
              "h-12 w-full rounded-md border bg-surface px-3 ps-10 text-start text-sm uppercase text-fg",
              "placeholder:normal-case placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-primary/25",
              invalid ? "border-danger focus:border-danger" : "border-border-strong focus:border-primary"
            )}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          loading={couponState.status === "loading"}
          disabled={!code.trim()}
        >
          اعمال
        </Button>
      </div>
      {invalid && (
        <p id="coupon-error" role="alert" className="mt-1.5 text-sm text-danger">{couponState.message}</p>
      )}
    </form>
  );
}
