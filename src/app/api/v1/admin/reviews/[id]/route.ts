import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { moderateReview } from "@/server/services/reviews";
import { reviewModerationSchema } from "@/server/schemas/admin";
import { prisma } from "@/server/lib/prisma";

/**
 * PATCH / DELETE /api/v1/admin/reviews/[id]
 *
 * Moderation recomputes the product's rating and review count from its approved
 * reviews, so un-approving a published review takes the numbers back down.
 */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, reviewModerationSchema);
  const { productId } = await moderateReview(params.id, input.status, input.note);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, rating: true, reviewCount: true },
  });

  await audit({
    action: "review.moderate",
    entityType: "review",
    entityId: params.id,
    summary: `دیدگاه محصول «${product?.name ?? productId}» به وضعیت «${input.status}» تغییر کرد`,
    meta: { status: input.status, note: input.note },
  });

  return ok({
    reviewId: params.id,
    status: input.status,
    // Returned so the UI can show the corrected aggregate immediately.
    product: { id: productId, rating: product?.rating, reviewCount: product?.reviewCount },
  });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  // Rejecting rather than deleting keeps the customer's own "my reviews" view
  // honest — they can see it was not published rather than have it vanish.
  const { productId } = await moderateReview(params.id, "rejected", "حذف‌شده توسط مدیر");

  await audit({
    action: "review.moderate",
    entityType: "review",
    entityId: params.id,
    summary: "دیدگاه از انتشار خارج شد",
    meta: { productId },
  });

  return ok({ removed: true, message: "دیدگاه از فروشگاه برداشته شد." });
});
