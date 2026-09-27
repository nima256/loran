import { handler, ok, readJson } from "@/server/lib/http";
import { getCustomer } from "@/server/lib/session";
import { validateCart } from "@/server/services/cart";
import { listShippingMethods } from "@/server/services/shipping";
import { validateCartSchema } from "@/server/schemas/checkout";

/**
 * POST /api/v1/cart/validate
 *
 * The repricing endpoint the cart page and the checkout both call. The client
 * sends identifiers and quantities; the response carries the authoritative
 * product, variant, stock, limits, prices, discounts and totals — plus a list
 * of anything that changed since the customer added the item, so the UI can
 * tell them rather than silently charging a different amount.
 *
 * Open to signed-out visitors: the cart is browsable before login, and the
 * customer id only affects per-customer coupon limits.
 */
export const POST = handler(async (request) => {
  const payload = await readJson(request, validateCartSchema);
  const customer = await getCustomer();

  const displayedPrices: Record<string, number> = {};
  for (const item of payload.items) {
    if (item.displayedPrice != null) displayedPrices[item.variantId] = item.displayedPrice;
  }

  const [cart, shippingMethods] = await Promise.all([
    validateCart({
      lines: payload.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      couponCode: payload.couponCode,
      shippingMethodCode: payload.shippingMethodCode,
      customerId: customer?.id ?? null,
      displayedPrices,
    }),
    listShippingMethods({ activeOnly: true }),
  ]);

  return ok({
    items: cart.items,
    removed: cart.removed,
    issues: cart.issues,
    totals: cart.totals,
    coupon: cart.coupon,
    couponError: cart.couponError,
    shipping: {
      selected: cart.shipping.code,
      cost: cart.shipping.cost,
      paidOnDelivery: cart.shipping.paidOnDelivery,
      freeShippingApplied: cart.shipping.freeShippingApplied,
      methods: shippingMethods,
    },
  });
});
