import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { getCustomerOrder, listCustomerOrders } from "@/server/services/order-queries";
import { createOrder } from "@/server/services/orders";
import { createReturnRequest, listReturnableOrders } from "@/server/services/returns";
import { updateAddress, deleteAddress } from "@/server/services/customers";
import { validateCart } from "@/server/services/cart";
import { createCustomer, createAddress, cleanupCustomer, variantWithStock } from "./helpers";

/**
 * Access control between customers.
 *
 * Every one of these is the same question: can customer A reach customer B's
 * data by knowing an identifier? The answer has to be no, and indistinguishable
 * from the identifier not existing — otherwise the error message itself
 * confirms the record is real.
 */

const created: string[] = [];

afterAll(async () => {
  for (const id of created) await cleanupCustomer(id);
  await prisma.$disconnect();
});

async function customerWithOrder() {
  const customer = await createCustomer();
  created.push(customer.id);
  const address = await createAddress(customer.id);
  const variant = await variantWithStock(10);

  const cart = await validateCart({
    lines: [{ variantId: variant.id, quantity: 1 }],
    customerId: customer.id,
  });

  const order = await createOrder({
    source: "online",
    customerId: customer.id,
    customer: { firstName: "آزمون", lastName: "کاربر", phone: customer.phone, email: null },
    address: {
      recipientFirstName: address.recipientFirstName,
      recipientLastName: address.recipientLastName,
      phone: address.phone,
      province: address.province,
      city: address.city,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
    },
    shipping: {
      id: cart.shipping.id, code: cart.shipping.code,
      name: cart.shipping.name, paidOnDelivery: cart.shipping.paidOnDelivery,
    },
    items: cart.items,
    totals: cart.totals,
    coupon: null,
    paymentMethod: "online",
    status: "awaiting_payment",
  });

  return { customer, address, order };
}

describe("one customer cannot reach another's data", () => {
  it("refuses another customer's order, indistinguishably from a missing one", async () => {
    const alice = await customerWithOrder();
    const bob = await createCustomer();
    created.push(bob.id);

    // Alice can see her own.
    await expect(getCustomerOrder(alice.customer.id, alice.order.number)).resolves.toBeTruthy();

    // Bob gets the same "not found" for Alice's order and for one that was
    // never created — the response cannot be used to confirm it exists.
    // Awaited one at a time: creating both promises first would leave the
    // second rejection unhandled until its turn.
    await expect(getCustomerOrder(bob.id, alice.order.number)).rejects.toThrow(/پیدا نشد/);
    await expect(getCustomerOrder(bob.id, "LRN-000000-0000")).rejects.toThrow(/پیدا نشد/);
  });

  it("never lists another customer's orders", async () => {
    const alice = await customerWithOrder();
    const bob = await createCustomer();
    created.push(bob.id);

    const bobsOrders = await listCustomerOrders(bob.id);
    expect(bobsOrders.map((o) => o.number)).not.toContain(alice.order.number);
    expect(bobsOrders).toHaveLength(0);
  });

  it("refuses to edit another customer's address", async () => {
    const alice = await customerWithOrder();
    const bob = await createCustomer();
    created.push(bob.id);

    await expect(
      updateAddress(bob.id, alice.address.id, { city: "تهران" })
    ).rejects.toThrow(/پیدا نشد/);

    // Alice's address is untouched.
    const unchanged = await prisma.address.findUniqueOrThrow({ where: { id: alice.address.id } });
    expect(unchanged.city).toBe("یزد");
  });

  it("refuses to delete another customer's address", async () => {
    const alice = await customerWithOrder();
    const bob = await createCustomer();
    created.push(bob.id);

    await expect(deleteAddress(bob.id, alice.address.id)).rejects.toThrow(/پیدا نشد/);
    await expect(
      prisma.address.findUnique({ where: { id: alice.address.id } })
    ).resolves.toBeTruthy();
  });

  it("refuses a return request against another customer's order", async () => {
    const alice = await customerWithOrder();
    const bob = await createCustomer();
    created.push(bob.id);

    const items = await prisma.orderItem.findMany({ where: { orderId: alice.order.id } });

    await expect(
      createReturnRequest({
        customerId: bob.id,
        orderId: alice.order.id,
        type: "return",
        reason: "سایز مناسب نبود",
        items: [{ orderItemId: items[0].id, quantity: 1 }],
      })
    ).rejects.toThrow(/پیدا نشد/);
  });
});

describe("return eligibility", () => {
  it("offers nothing for an order that was never delivered", async () => {
    const alice = await customerWithOrder();
    const eligible = await listReturnableOrders(alice.customer.id);
    expect(eligible).toHaveLength(0);
  });

  it("refuses a return on an undelivered order", async () => {
    const alice = await customerWithOrder();
    const items = await prisma.orderItem.findMany({ where: { orderId: alice.order.id } });

    await expect(
      createReturnRequest({
        customerId: alice.customer.id,
        orderId: alice.order.id,
        type: "return",
        reason: "سایز مناسب نبود",
        items: [{ orderItemId: items[0].id, quantity: 1 }],
      })
    ).rejects.toThrow(/تحویل‌شده/);
  });

  it("refuses to return more units than were bought", async () => {
    const alice = await customerWithOrder();

    // Make it eligible: delivered, inside the window.
    await prisma.order.update({
      where: { id: alice.order.id },
      data: { status: "delivered", deliveredAt: new Date(), paymentStatus: "paid" },
    });

    const items = await prisma.orderItem.findMany({ where: { orderId: alice.order.id } });

    await expect(
      createReturnRequest({
        customerId: alice.customer.id,
        orderId: alice.order.id,
        type: "return",
        reason: "سایز مناسب نبود",
        items: [{ orderItemId: items[0].id, quantity: items[0].quantity + 5 }],
      })
    ).rejects.toThrow();
  });

  it("refuses a second request for units already claimed", async () => {
    const alice = await customerWithOrder();
    await prisma.order.update({
      where: { id: alice.order.id },
      data: { status: "delivered", deliveredAt: new Date(), paymentStatus: "paid" },
    });

    const items = await prisma.orderItem.findMany({ where: { orderId: alice.order.id } });

    await createReturnRequest({
      customerId: alice.customer.id,
      orderId: alice.order.id,
      type: "return",
      reason: "سایز مناسب نبود",
      items: [{ orderItemId: items[0].id, quantity: items[0].quantity }],
    });

    // Everything is now spoken for.
    await expect(
      createReturnRequest({
        customerId: alice.customer.id,
        orderId: alice.order.id,
        type: "exchange",
        reason: "نظرم عوض شد",
        items: [{ orderItemId: items[0].id, quantity: 1 }],
      })
    ).rejects.toThrow(/قبلاً درخواست مرجوعی ثبت شده|حداکثر/);
  });

  it("refuses a return outside the return window", async () => {
    const alice = await customerWithOrder();
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 60);

    await prisma.order.update({
      where: { id: alice.order.id },
      data: { status: "delivered", deliveredAt: longAgo, paymentStatus: "paid" },
    });

    const items = await prisma.orderItem.findMany({ where: { orderId: alice.order.id } });

    await expect(
      createReturnRequest({
        customerId: alice.customer.id,
        orderId: alice.order.id,
        type: "return",
        reason: "سایز مناسب نبود",
        items: [{ orderItemId: items[0].id, quantity: 1 }],
      })
    ).rejects.toThrow(/مهلت/);
  });
});
