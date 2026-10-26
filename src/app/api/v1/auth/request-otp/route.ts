import { z } from "zod";
import { handler, ok, readJson, requestContext } from "@/server/lib/http";
import { phoneSchema } from "@/server/lib/validation";
import { issueOtp } from "@/server/services/otp";
import { prisma } from "@/server/lib/prisma";
import { ApiError } from "@/server/lib/errors";

/** POST /api/v1/auth/request-otp — step one of the customer sign-in flow. */

const bodySchema = z.object({ phone: phoneSchema });

export const POST = handler(async (request) => {
  const { phone } = await readJson(request, bodySchema);
  const { ip } = requestContext(request);

  // A blocked customer is turned away before an SMS is ever sent, so a blocked
  // account cannot be used to burn the store's SMS credit.
  const existing = await prisma.customer.findUnique({
    where: { phone },
    select: { blocked: true },
  });
  if (existing?.blocked) {
    throw new ApiError("forbidden", "دسترسی این حساب کاربری مسدود شده است.");
  }

  const result = await issueOtp({ phone, ip });

  return ok({
    phone,
    expiresInSeconds: result.expiresInSeconds,
    resendAfterSeconds: result.resendAfterSeconds,
    // Present only under OTP_MOCK, which never survives production start-up.
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
});
