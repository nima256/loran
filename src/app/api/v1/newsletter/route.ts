import { z } from "zod";
import { handler, created, readJson, requestContext } from "@/server/lib/http";
import { emailSchema, optionalText } from "@/server/lib/validation";
import { RATE_LIMITS, enforceRateLimit } from "@/server/lib/rate-limit";
import { subscribeNewsletter } from "@/server/services/submissions";

/**
 * POST /api/v1/newsletter — newsletter sign-up.
 *
 * An address that is already subscribed is a success, not an error: telling
 * someone they are already on the list is fine; an error page for typing their
 * own address twice is not.
 */

const bodySchema = z.object({
  email: emailSchema,
  source: optionalText(40),
});

export const POST = handler(async (request) => {
  const { ip } = requestContext(request);
  await enforceRateLimit(RATE_LIMITS.submissionIp, ip);

  const { email, source } = await readJson(request, bodySchema);
  const result = await subscribeNewsletter(email, source);

  return created({
    ...result,
    message: result.created
      ? "ایمیل شما ثبت شد. از این پس تخفیف‌ها و مدل‌های تازه را زودتر می‌بینید."
      : result.resubscribed
        ? "اشتراک خبرنامه شما دوباره فعال شد."
        : "این ایمیل از قبل در خبرنامه ثبت شده است.",
  });
});
