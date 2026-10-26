import { handler, ok } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { prisma } from "@/server/lib/prisma";

/**
 * GET /api/v1/account/reviewable
 *
 * Products the customer has actually bought (in a paid order) and not yet
 * reviewed. Buying is the gate, so the "awaiting your review" list cannot be
 * gamed by visiting a product page.
 */
export const GET = handler(async () => {
  const customer = await requireCustomer();

  const [items, reviewed] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        productId: { not: null },
        order: { customerId: customer.id, paymentStatus: "paid" },
      },
      orderBy: { order: { createdAt: "desc" } },
      select: {
        productId: true,
        name: true,
        image: true,
        slug: true,
        colorName: true,
        size: true,
        order: { select: { number: true, createdAt: true, status: true } },
      },
    }),
    prisma.review.findMany({
      where: { customerId: customer.id },
      select: { productId: true },
    }),
  ]);

  const reviewedIds = new Set(reviewed.map((r) => r.productId));
  const seen = new Set<string>();
  const pending: {
    productId: string;
    name: string;
    image: string;
    slug: string;
    colorName: string;
    size: number;
    orderNumber: string;
    purchasedAt: string;
  }[] = [];

  for (const item of items) {
    if (!item.productId || reviewedIds.has(item.productId) || seen.has(item.productId)) continue;
    // Only delivered orders — reviewing a shoe still in transit is premature.
    if (item.order.status !== "delivered") continue;
    seen.add(item.productId);
    pending.push({
      productId: item.productId,
      name: item.name,
      image: item.image,
      slug: item.slug,
      colorName: item.colorName,
      size: item.size,
      orderNumber: item.order.number,
      purchasedAt: item.order.createdAt.toISOString(),
    });
  }

  return ok({ pending });
});
