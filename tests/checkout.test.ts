import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { validateCart } from "@/server/services/cart";
import { validateCoupon } from "@/server/services/coupons";
import { createOrder, finalizePaidOrder } from "@/server/services/orders";
import { createCustomer, cleanupCustomer, variantWithStock } from "./helpers";

/**
 * Checkout: price authority, stock safety and payment idempotency.
 *
 * These run against a real PostgreSQL database on purpose — what is being
 * tested is transactions, unique constraints and concurrency, none of which a
 * mocked client exercises.
 */

const created: string[] = [];

afterAll(async () => {
  for (const id of created) await cleanupCustomer(id);
  await prisma.$disconnect();
});

async function newCustomer() {
  const customer = await createCustomer();
  created.push(customer.id);
  return customer;
}

async function placeOrder(customerId: string, variantId: string, quantity: number, couponCode?: string) {
  const cart = await validateCart({ lines: [{ variantId, quantity }], couponCode, customerId });
  const coupon = cart.coupon
    ? await validateCoupon(cart.coupon.code, cart.totals.subtotal, customerId)
    : null;

  return createOrder({
    source: "online",
    customerId,
    customer: { firstName: "آزمون", lastName: "کاربر", phone: "09120000000", email: null },
    address: {
      recipientFirstName: "آزمون", recipientLastName: "کاربر", phone: "09120000000",
      province: "یزد", city: "یزد", addressLine: "خیابان آزمایشی", postalCode: "8916745231",
    },
    shipping: {
      id: cart.shipping.id, code: cart.shipping.code,
      name: cart.shipping.name, paidOnDelivery: cart.shipping.paidOnDelivery,
    },
    items: cart.items,
    totals: cart.totals,
    coupon: coupon ? { id: coupon.couponId, code: coupon.coupon.code, discount: coupon.discount } : null,
    paymentMethod: "online",
    status: "awaiting_payment",
  });
}

describe("server price authority", () => {
  it("charges the database price, not one the client claims", async () => {
    const customer = await newCustomer();
    const variant = await variantWithStock(10);

    const cart = await validateCart({
      lines: [{ variantId: variant.id, quantity: 2 }],
      customerId: customer.id,
      // The client insists this costs one Toman.
      displayedPrices: { [variant.id]: 1 },
    });

    expect(cart.items[0].price).toBe(variant.product.price);
    expect(cart.totals.subtotal).toBe(variant.product.price * 2);
    // The mismatch is reported so the customer is told, not charged silently.
    expect(cart.issues.some((i) => i.code === "price_changed")).toBe(true);
  });

  it("caps quantity at the stock actually on the shelf", async () => {
    const customer = await newCustomer();
    const variant = await variantWithStock(3);

    const cart = await validateCart({
      lines: [{ variantId: variant.id, quantity: 9 }],
      customerId: customer.id,
    });

    expect(cart.items[0].quantity).toBe(3);
    expect(cart.issues.some((i) => i.code === "reduced_quantity")).toBe(true);
  });

  it("drops an out-of-stock line and says so", async () => {
    const customer = await newCustomer();
    const variant = await variantWithStock(0);

    const cart = await validateCart({
      lines: [{ variantId: variant.id, quantity: 1 }],
      customerId: customer.id,
    });

    expect(cart.items).toHaveLength(0);
    expect(cart.removed[0].reason).toBe("out_of_stock");

    await variantWithStock(10);
  });

  it("ignores a variant id that does not exist rather than trusting it", async () => {
    const customer = await newCustomer();
    const cart = await validateCart({
      lines: [{ variantId: "definitely-not-a-variant", quantity: 1 }],
      customerId: customer.id,
    });
    expect(cart.items).toHaveLength(0);
    expect(cart.removed[0].reason).toBe("unavailable");
  });
});

describe("payment finalisation is idempotent", () => {
  it("decrements stock, redeems the coupon and writes the event exactly once", async () => {
    const customer = await newCustomer();
    const variant = await variantWithStock(10);
    const order = await placeOrder(customer.id, variant.id, 2, "LORAN10");

    const couponBefore = await prisma.coupon.findFirstOrThrow({ where: { code: "LORAN10" } });

    const first = await finalizePaidOrder({ orderId: order.id, paymentRef: "REF-1" });
    expect(first.changed).toBe(true);

    // The customer refreshes while the gateway retries.
    const [second, third] = await Promise.all([
      finalizePaidOrder({ orderId: order.id, paymentRef: "REF-2" }),
      finalizePaidOrder({ orderId: order.id, paymentRef: "REF-3" }),
    ]);
    expect(second.changed).toBe(false);
    expect(third.changed).toBe(false);

    const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
    expect(after.stock).toBe(8);

    const redemptions = await prisma.couponRedemption.count({ where: { orderId: order.id } });
    expect(redemptions).toBe(1);

    const couponAfter = await prisma.coupon.findFirstOrThrow({ where: { code: "LORAN10" } });
    expect(couponAfter.usageCount).toBe(couponBefore.usageCount + 1);

    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events.filter((e) => e.status === "preparing")).toHaveLength(1);

    // The first callback's reference is the one kept.
    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(final.paymentRef).toBe("REF-1");
    expect(final.paymentStatus).toBe("paid");

    await variantWithStock(10);
  });
});

describe("stock cannot be oversold", () => {
  it("lets exactly one of several concurrent orders take the last units", async () => {
    const variant = await variantWithStock(3);

    const customers = await Promise.all([newCustomer(), newCustomer(), newCustomer(), newCustomer()]);
    const orders = await Promise.all(
      customers.map((c) => placeOrder(c.id, variant.id, 2))
    );

    // All four "pay" at the same instant.
    const results = await Promise.allSettled(
      orders.map((o, i) => finalizePaidOrder({ orderId: o.id, paymentRef: `RACE-${i}` }))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const after = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });

    // 3 units, 2 per order — only one order can fit.
    expect(succeeded).toBe(1);
    expect(after.stock).toBe(1);
    expect(after.stock).toBeGreaterThanOrEqual(0);

    // A loser gets the honest out-of-stock message, not a driver error.
    const rejected = results.find((r) => r.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason.message).toContain("موجودی");

    await variantWithStock(10);
  });
});

describe("coupons", () => {
  it("computes the discount server-side and caps it", async () => {
    const customer = await newCustomer();
    const variant = await variantWithStock(10);

    const cart = await validateCart({
      lines: [{ variantId: variant.id, quantity: 4 }],
      couponCode: "LORAN10",
      customerId: customer.id,
    });

    // 10%, capped at 400,000.
    const expected = Math.min(Math.round(cart.totals.subtotal * 0.1), 400_000);
    expect(cart.totals.couponDiscount).toBe(expected);
    expect(cart.totals.payableOnline).toBe(cart.totals.subtotal - expected);
  });

  it("refuses a second use of a per-customer-limited coupon", async () => {
    const customer = await newCustomer();
    const variant = await variantWithStock(10);

    const order = await placeOrder(customer.id, variant.id, 1, "LORAN10");
    await finalizePaidOrder({ orderId: order.id, paymentRef: "REF" });

    await expect(
      validateCoupon("LORAN10", 5_000_000, customer.id)
    ).rejects.toThrow(/قبلاً از این کد تخفیف استفاده/);

    await variantWithStock(10);
  });

  it("rejects an unknown code and one below its minimum", async () => {
    await expect(validateCoupon("NOT-A-REAL-CODE", 1_000_000, null)).rejects.toThrow(/نامعتبر/);
    // WELCOME requires a 1,500,000 subtotal.
    await expect(validateCoupon("WELCOME", 100_000, null)).rejects.toThrow(/فعال می‌شود/);
  });

  it("is case-insensitive, because customers type codes however they like", async () => {
    const result = await validateCoupon("loran10", 2_000_000, null);
    expect(result.coupon.code).toBe("LORAN10");
  });
});
