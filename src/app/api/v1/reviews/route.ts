import { z } from "zod";
import { handler, created, readJson } from "@/server/lib/http";
import { requireCustomer } from "@/server/lib/session";
import { cuidSchema, optionalText, text } from "@/server/lib/validation";
import { RATE_LIMITS, enforceRateLimit } from "@/server/lib/rate-limit";
import { createReview } from "@/server/services/reviews";

/**
 * POST /api/v1/reviews — submits a review for moderation.
 *
 * The review is created `pending` and does not affect the product's rating
 * until an administrator approves it. `verifiedPurchase` is decided from the
 * order history server-side, never from the request.
 */

const bodySchema = z.object({
  productId: cuidSchema,
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalText(120),
  body: text(10, 2000, "متن دیدگاه باید حداقل ۱۰ کاراکتر باشد."),
  sizeFeedback: z.enum(["small", "true", "large"]).optional(),
});

export const POST = handler(async (request) => {
  const customer = await requireCustomer();
  await enforceRateLimit(RATE_LIMITS.reviewCustomer, customer.id);

  const input = await readJson(request, bodySchema);
  const authorName =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "مشتری لوران";

  const review = await createReview({ ...input, customerId: customer.id, authorName });
  return created({
    review,
    message: "دیدگاه شما ثبت شد و پس از بررسی منتشر می‌شود.",
  });
});
