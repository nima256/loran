import { handler, created, readJson } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { prisma } from "@/server/lib/prisma";
import { badRequest, forbidden, notFound, outOfStock } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";
import { RATE_LIMITS, enforceRateLimit } from "@/server/lib/rate-limit";
import { validateCart } from "@/server/services/cart";
import { validateCoupon } from "@/server/services/coupons";
import { createOrder, finalizePaidOrder, sendOrderRegisteredSms } from "@/server/services/orders";
import { isMockMode, requestPayment } from "@/server/services/zarinpal";
import { checkoutSchema } from "@/server/schemas/checkout";

/**
 * POST /api/v1/checkout — creates the order and opens the payment.
 *
 * The sequence, and why it is this order:
 *
 *  1. Authenticate. Login is required before checkout; there is no guest flow.
 *  2. Reload every product, variant and price from PostgreSQL. What the client
 *     sent about money is discarded — it only chose variants and quantities.
 *  3. Recompute subtotal, discounts, coupon and shipping server-side.
 *  4. Create a PENDING order, with the number generated on the server.
 *  5. Ask ZarinPal for a payment and store the Authority against that order.
 *  6. Hand the customer the redirect URL.
 *
 * Stock is deliberately NOT committed here. An abandoned payment must not hold
 * inventory hostage, so the decrement happens once the callback verifies — see
 * `finalizePaidOrder`. The atomic `stock >= quantity` guard there is what makes
 * that safe under concurrency.
 */
export const POST = handler(async (request) => {
  const customer = await requireCustomer();
  const payload = await readJson(request, checkoutSchema);

  await enforceRateLimit(RATE_LIMITS.checkoutCustomer, customer.id);

  /* --- Address: must belong to this customer -------------------------- */
  const address = await prisma.address.findFirst({
    where: { id: payload.addressId, customerId: customer.id },
  });
  if (!address) throw notFound("آدرس انتخاب‌شده پیدا نشد.");

  /* --- Authoritative repricing ---------------------------------------- */
  const cart = await validateCart({
    lines: payload.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    couponCode: payload.couponCode,
    shippingMethodCode: payload.shippingMethodCode,
    customerId: customer.id,
  });

  if (!cart.items.length) {
    throw badRequest("سبد خرید شما خالی است یا کالاهای آن دیگر موجود نیستند.");
  }

  // Anything that changed between the cart screen and here stops the checkout
  // so the customer can look at it, rather than being charged a surprise.
  const blocking = cart.issues.filter((i) => i.code !== "price_changed");
  if (blocking.length || cart.removed.length) {
    throw outOfStock(
      `${blocking[0]?.message ?? "برخی از کالاهای سبد شما تغییر کرده‌اند."} لطفاً سبد خرید را بازبینی کنید.`
    );
  }
  if (payload.couponCode && cart.couponError) {
    throw badRequest(cart.couponError);
  }

  // Re-resolve the coupon to get its id for the order row.
  const coupon = cart.coupon
    ? await validateCoupon(cart.coupon.code, cart.totals.subtotal, customer.id)
    : null;

  const profile = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  if (profile.blocked) throw forbidden("دسترسی این حساب کاربری مسدود شده است.");

  /* --- Pending order --------------------------------------------------- */
  const order = await createOrder({
    source: "online",
    customerId: customer.id,
    customer: {
      firstName: profile.firstName ?? address.recipientFirstName,
      lastName: profile.lastName ?? address.recipientLastName,
      phone: profile.phone,
      email: profile.email,
    },
    address: {
      recipientFirstName: address.recipientFirstName,
      recipientLastName: address.recipientLastName,
      phone: address.phone,
      province: address.province,
      city: address.city,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
      plaque: address.plaque,
      unit: address.unit,
    },
    shipping: {
      id: cart.shipping.id,
      code: cart.shipping.code,
      name: cart.shipping.name,
      paidOnDelivery: cart.shipping.paidOnDelivery,
    },
    items: cart.items,
    totals: cart.totals,
    coupon: coupon ? { id: coupon.couponId, code: coupon.coupon.code, discount: coupon.discount } : null,
    customerNote: payload.note,
    paymentMethod: "online",
    status: "awaiting_payment",
    smsNotifications: profile.smsNotifications,
  });

  /* --- Fully discounted order: nothing to charge ----------------------- */
  if (cart.totals.payableOnline <= 0) {
    await finalizePaidOrder({ orderId: order.id, paymentRef: "FREE" });
    await sendOrderRegisteredSms(order.id);
    return created({
      orderNumber: order.number,
      redirectUrl: `/payment/success?order=${encodeURIComponent(order.number)}`,
    });
  }

  /* --- Local mock mode ------------------------------------------------- */
  if (isMockMode()) {
    // Dev only: `env` refuses to start production with PAYMENT_MOCK on.
    logger.warn("پرداخت در حالت شبیه‌سازی تأیید شد", { orderNumber: order.number });
    await finalizePaidOrder({ orderId: order.id, paymentRef: `MOCK-${Date.now()}` });
    await sendOrderRegisteredSms(order.id);
    return created({
      orderNumber: order.number,
      redirectUrl: `/payment/success?order=${encodeURIComponent(order.number)}`,
    });
  }

  /* --- ZarinPal -------------------------------------------------------- */
  try {
    const payment = await requestPayment({
      amount: cart.totals.payableOnline,
      description: `سفارش ${order.number} - فروشگاه لوران`,
      mobile: profile.phone,
      email: profile.email ?? undefined,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentAuthority: payment.authority, paymentUrl: payment.url },
    });

    return created({
      orderNumber: order.number,
      paymentUrl: payment.url,
      redirectUrl: payment.url,
    });
  } catch (error) {
    // The order is kept rather than deleted, marked failed with a reason. It
    // stays visible to the customer and the administrator, which is what makes
    // a gateway outage diagnosable instead of a silent dead end.
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: "failed", status: "payment_failed" },
      }),
      prisma.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: "payment_failed",
          actor: "system",
          note: "اتصال به درگاه پرداخت برقرار نشد",
        },
      }),
    ]);
    logger.error("ایجاد تراکنش پرداخت ناموفق بود", {
      orderNumber: order.number,
      cause: error,
    });
    throw error;
  }
});
