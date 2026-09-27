import type { CartItem, OrderTotals, ShippingMethod } from "@/types";

/**
 * Client-side cart arithmetic.
 *
 * These are display helpers only. The authoritative totals — the ones an order
 * is created from — are computed by the server in
 * `src/server/services/cart.ts`, and the cart page replaces anything here with
 * the server's figures as soon as the validation response arrives.
 *
 * What remains is the optimistic maths that keeps the mini-cart and the
 * quantity stepper responsive between server round-trips. It deliberately knows
 * nothing about coupons: a coupon discount is never calculated in the browser.
 */

export function lineTotal(item: CartItem): number {
  return item.price * item.quantity;
}

export function lineCompareTotal(item: CartItem): number {
  return (item.compareAtPrice ?? item.price) * item.quantity;
}

export function itemCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function subtotalOf(items: CartItem[]): number {
  return items.reduce((n, i) => n + lineTotal(i), 0);
}

/**
 * An optimistic total for the moments before the server answers.
 *
 * `couponDiscount` is whatever the server last told us — it is carried, never
 * recomputed, because the browser has no business deciding it.
 */
export function optimisticTotals(
  items: CartItem[],
  options: { couponDiscount?: number; shipping?: Pick<ShippingMethod, "cost" | "paidOnDelivery"> } = {}
): OrderTotals {
  const subtotal = subtotalOf(items);
  const compareSubtotal = items.reduce((n, i) => n + lineCompareTotal(i), 0);
  const couponDiscount = Math.min(options.couponDiscount ?? 0, subtotal);
  const afterCoupon = Math.max(0, subtotal - couponDiscount);

  const shippingCost = options.shipping?.cost ?? 0;
  const paidOnDelivery = options.shipping?.paidOnDelivery ?? true;

  return {
    subtotal,
    productDiscount: compareSubtotal - subtotal,
    couponDiscount,
    shippingCost,
    // Postpaid shipping is collected by the courier, so it stays out of the
    // amount charged online.
    payableOnline: paidOnDelivery ? afterCoupon : afterCoupon + shippingCost,
    grandTotal: afterCoupon + shippingCost,
  };
}

/** The empty-cart totals, used before hydration and after clearing. */
export const EMPTY_TOTALS: OrderTotals = {
  subtotal: 0,
  productDiscount: 0,
  couponDiscount: 0,
  shippingCost: 0,
  payableOnline: 0,
  grandTotal: 0,
};
