import { z } from "zod";
import { handler, ok, readQuery } from "@/server/lib/http";
import { unsubscribeNewsletter } from "@/server/services/submissions";

/**
 * GET /api/v1/newsletter/unsubscribe?token=…
 *
 * Keyed by an unguessable token rather than an email address, so the link in
 * one person's inbox cannot be edited to unsubscribe somebody else.
 */

const querySchema = z.object({ token: z.string().min(10).max(120) });

export const GET = handler(async (request) => {
  const { token } = readQuery(request, querySchema);
  const removed = await unsubscribeNewsletter(token);
  return ok({
    removed,
    message: removed
      ? "اشتراک شما در خبرنامه لغو شد."
      : "این لینک معتبر نیست یا قبلاً استفاده شده است.",
  });
});
