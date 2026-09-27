import { z } from "zod";
import { handler, created, readJson, requestContext } from "@/server/lib/http";
import { getCustomer } from "@/server/lib/session";
import { optionalText, phoneSchema, text } from "@/server/lib/validation";
import { RATE_LIMITS, enforceRateLimit } from "@/server/lib/rate-limit";
import { createConsultation } from "@/server/services/submissions";

/**
 * POST /api/v1/consultations — size and model consultation requests.
 *
 * Open to signed-out visitors; when a customer happens to be signed in the
 * request is linked to their account so the administrator has the context.
 */

const bodySchema = z.object({
  fullName: text(2, 80, "نام و نام خانوادگی را وارد کنید."),
  phone: phoneSchema,
  message: optionalText(1000),
  /** The form's structured answers, stored as submitted. */
  answers: z.record(z.string().max(60), z.union([z.string().max(500), z.array(z.string().max(120)).max(30)])).default({}),
});

export const POST = handler(async (request) => {
  const { ip } = requestContext(request);
  await enforceRateLimit(RATE_LIMITS.submissionIp, ip);

  const input = await readJson(request, bodySchema);
  const customer = await getCustomer();

  const result = await createConsultation({
    fullName: input.fullName,
    phone: input.phone,
    answers: input.answers,
    message: input.message,
    customerId: customer?.id ?? null,
  });

  return created({
    number: result.number,
    message: "درخواست مشاوره شما ثبت شد. کارشناسان لوران به‌زودی تماس می‌گیرند.",
  });
});
