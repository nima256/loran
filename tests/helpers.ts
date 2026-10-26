import { prisma } from "@/server/lib/prisma";

/**
 * Shared test fixtures.
 *
 * These run against a real PostgreSQL database — the point of these tests is
 * the behaviour of transactions, constraints and concurrency, none of which a
 * mocked client would exercise.
 */

let counter = 0;

/** A phone number no other test will collide with. */
export function uniquePhone(): string {
  counter += 1;
  return `0912${String(Date.now()).slice(-6)}${String(counter % 10)}`;
}

export async function createCustomer(overrides: Partial<{ phone: string; blocked: boolean }> = {}) {
  return prisma.customer.create({
    data: {
      phone: overrides.phone ?? uniquePhone(),
      firstName: "آزمون",
      lastName: "کاربر",
      blocked: overrides.blocked ?? false,
    },
  });
}

export async function createAddress(customerId: string) {
  return prisma.address.create({
    data: {
      customerId,
      title: "خانه",
      recipientFirstName: "آزمون",
      recipientLastName: "کاربر",
      phone: "09120000000",
      province: "یزد",
      city: "یزد",
      addressLine: "خیابان آزمایشی، پلاک ۱",
      postalCode: "8916745231",
      isDefault: true,
    },
  });
}

/** A variant with a known stock level, for the inventory tests. */
export async function variantWithStock(stock: number) {
  const variant = await prisma.productVariant.findFirstOrThrow({
    where: { active: true, product: { active: true } },
    include: { product: true },
  });
  await prisma.productVariant.update({ where: { id: variant.id }, data: { stock } });
  return { ...variant, stock };
}

export async function resetVariantStock(variantId: string, stock: number) {
  await prisma.productVariant.update({ where: { id: variantId }, data: { stock } });
}

/** Removes the rows a test created, newest first. */
export async function cleanupCustomer(customerId: string) {
  const orders = await prisma.order.findMany({ where: { customerId }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length) {
    await prisma.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  await prisma.customer.delete({ where: { id: customerId } }).catch(() => undefined);
}
