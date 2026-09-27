import "server-only";
import { prisma, type Db } from "../lib/prisma";
import { conflict, notFound } from "../lib/errors";
import type { RatingBreakdown, Review } from "@/types";
import type { ReviewStatus, SizeFeedback } from "@prisma/client";

/**
 * Product reviews and their moderation.
 *
 * A new review is `pending` and invisible to the storefront until an
 * administrator approves it. Only approved reviews count towards a product's
 * rating and review count, which is why every moderation action recomputes the
 * aggregate rather than adjusting it by hand — an incremental update would
 * drift the first time a moderation was reversed.
 */

const SIZE_FEEDBACK_OUT: Record<SizeFeedback, "small" | "true" | "large"> = {
  small: "small",
  true_to_size: "true",
  large: "large",
};

const SIZE_FEEDBACK_IN = {
  small: "small",
  true: "true_to_size",
  large: "large",
} as const;

type ReviewRow = {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: Date;
  verifiedPurchase: boolean;
  helpfulCount: number;
  purchasedColorName: string | null;
  purchasedSize: number | null;
  sizeFeedback: SizeFeedback | null;
};

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    productId: row.productId,
    authorName: row.authorName,
    rating: row.rating,
    title: row.title ?? undefined,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    verifiedPurchase: row.verifiedPurchase,
    helpfulCount: row.helpfulCount,
    purchasedVariant:
      row.purchasedColorName && row.purchasedSize != null
        ? { colorName: row.purchasedColorName, size: row.purchasedSize }
        : undefined,
    sizeFeedback: row.sizeFeedback ? SIZE_FEEDBACK_OUT[row.sizeFeedback] : undefined,
  };
}

/** Published reviews for a product, newest first. */
export async function getProductReviews(productId: string): Promise<Review[]> {
  const rows = await prisma.review.findMany({
    where: { productId, status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toReview);
}

/**
 * The rating summary shown on a product page.
 *
 * Computed from approved reviews only, so a pending or rejected review never
 * moves a public number.
 */
export async function getRatingBreakdown(
  productId: string,
  fallbackAverage: number
): Promise<RatingBreakdown> {
  const [byRating, bySizeFeedback] = await Promise.all([
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId, status: "approved" },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["sizeFeedback"],
      where: { productId, status: "approved", sizeFeedback: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as RatingBreakdown["distribution"];
  let total = 0;
  let sum = 0;
  for (const row of byRating) {
    const star = Math.min(5, Math.max(1, Math.round(row.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += row._count._all;
    total += row._count._all;
    sum += row.rating * row._count._all;
  }

  const sizeFeedback = { small: 0, true: 0, large: 0 };
  for (const row of bySizeFeedback) {
    if (row.sizeFeedback) sizeFeedback[SIZE_FEEDBACK_OUT[row.sizeFeedback]] += row._count._all;
  }

  return {
    average: total ? Number((sum / total).toFixed(1)) : fallbackAverage,
    total,
    distribution,
    sizeFeedback,
  };
}

export interface CreateReviewInput {
  productId: string;
  customerId: string;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
  sizeFeedback?: "small" | "true" | "large";
}

/**
 * Submits a review for moderation.
 *
 * `verifiedPurchase` is decided here, from the order history — never from
 * anything the client sends.
 */
export async function createReview(input: CreateReviewInput): Promise<Review> {
  const existing = await prisma.review.findFirst({
    where: { productId: input.productId, customerId: input.customerId },
  });
  if (existing) {
    throw conflict("شما قبلاً برای این محصول دیدگاه ثبت کرده‌اید.");
  }

  // A purchase counts only when the order was actually paid for.
  const purchase = await prisma.orderItem.findFirst({
    where: {
      productId: input.productId,
      order: { customerId: input.customerId, paymentStatus: "paid" },
    },
    orderBy: { order: { createdAt: "desc" } },
    select: { colorName: true, size: true },
  });

  const row = await prisma.review.create({
    data: {
      productId: input.productId,
      customerId: input.customerId,
      authorName: input.authorName,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      status: "pending",
      verifiedPurchase: Boolean(purchase),
      purchasedColorName: purchase?.colorName ?? null,
      purchasedSize: purchase?.size ?? null,
      sizeFeedback: input.sizeFeedback ? SIZE_FEEDBACK_IN[input.sizeFeedback] : null,
    },
  });
  return toReview(row);
}

/** A customer's own reviews, including the ones still awaiting moderation. */
export async function listCustomerReviews(customerId: string) {
  const rows = await prisma.review.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { slug: true, name: true } } },
  });
  return rows.map((row) => ({
    ...toReview(row),
    status: row.status,
    productSlug: row.product.slug,
    productName: row.product.name,
  }));
}

/* ------------------------------------------------------------ moderation -- */

export async function moderateReview(
  reviewId: string,
  status: ReviewStatus,
  note?: string
): Promise<{ productId: string }> {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw notFound("دیدگاه پیدا نشد.");

  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: reviewId },
      data: { status, moderationNote: note ?? null, moderatedAt: new Date() },
    });
    await recomputeProductRating(tx, review.productId);
  });

  return { productId: review.productId };
}

/**
 * Recomputes a product's `rating` and `reviewCount` from its approved reviews.
 *
 * Always a recomputation, never an increment: un-approving a review has to be
 * able to take the numbers back down, and a drifted aggregate is impossible to
 * notice from the storefront.
 */
export async function recomputeProductRating(db: Db, productId: string): Promise<void> {
  const aggregate = await db.review.aggregate({
    where: { productId, status: "approved" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await db.product.update({
    where: { id: productId },
    data: {
      rating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0,
      reviewCount: aggregate._count._all,
    },
  });
}
