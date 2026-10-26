"use client";

import { useEffect } from "react";
import { useCart } from "@/store/CartProvider";
import { forgetPendingPayment, hasPendingPayment } from "@/lib/payment-return";

/**
 * Checkout no longer clears the cart before the customer leaves for ZarinPal.
 * Clear it only upon returning to the successful-payment page, for the order
 * that initiated the gateway redirect in this same tab. Failed/cancelled
 * payments leave the cart available for another attempt.
 */
export function ClearPaidCart({ orderNumber }: { orderNumber: string }) {
  const { clear, hydrating } = useCart();

  useEffect(() => {
    // Wait for localStorage hydration: clearing before it finishes could be
    // overwritten by the persisted cart arriving a moment later.
    if (hydrating || !hasPendingPayment(orderNumber)) return;
    forgetPendingPayment();
    clear();
  }, [clear, hydrating, orderNumber]);

  return null;
}
