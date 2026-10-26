import { z } from "zod";
import { handler, created, readJson, requestContext } from "@/server/lib/http";
import { optionalEmailSchema, optionalText, text } from "@/server/lib/validation";
import { RATE_LIMITS, enforceRateLimit } from "@/server/lib/rate-limit";
import { createContactMessage } from "@/server/services/submissions";
import { normalizeIranMobile } from "@/lib/persian";

/** POST /api/v1/contact — the Contact Us form. */

const bodySchema = z
  .object({
    fullName: text(2, 80, "نام و نام خانوادگی را وارد کنید."),
    phone: optionalText(20),
    email: optionalEmailSchema,
    subject: text(2, 120, "موضوع پیام را وارد کنید."),
    message: text(10, 2000, "متن پیام باید حداقل ۱۰ کاراکتر باشد."),
  })
  // At least one way to reply, or the message is a dead end for the store.
  .refine((value) => Boolean(value.phone || value.email), {
    message: "شماره موبایل یا ایمیل را وارد کنید تا بتوانیم پاسخ دهیم.",
    path: ["phone"],
  })
  .refine((value) => !value.phone || normalizeIranMobile(value.phone) !== "", {
    message: "شماره موبایل معتبر نیست.",
    path: ["phone"],
  });

export const POST = handler(async (request) => {
  const { ip } = requestContext(request);
  await enforceRateLimit(RATE_LIMITS.submissionIp, ip);

  const input = await readJson(request, bodySchema);
  const result = await createContactMessage({
    ...input,
    phone: input.phone ? normalizeIranMobile(input.phone) : undefined,
  });

  return created({
    number: result.number,
    message: "پیام شما ثبت شد. همکاران ما در اولین فرصت پاسخ می‌دهند.",
  });
});
