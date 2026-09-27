import { z } from "zod";
import { handler, ok, readJson, requestContext } from "@/server/lib/http";
import { otpCodeSchema, phoneSchema } from "@/server/lib/validation";
import { verifyOtp } from "@/server/services/otp";
import { findOrCreateByPhone, listAddresses, toUser } from "@/server/services/customers";
import { createCustomerSession } from "@/server/lib/session";

/**
 * POST /api/v1/auth/verify-otp — step two.
 *
 * On success the customer receives a fresh HttpOnly session cookie. The session
 * is created *after* verification and rotates any previous one, so a token held
 * before sign-in cannot be reused afterwards.
 */

const bodySchema = z.object({ phone: phoneSchema, code: otpCodeSchema });

export const POST = handler(async (request) => {
  const { phone, code } = await readJson(request, bodySchema);
  const { ip, userAgent } = requestContext(request);

  await verifyOtp(phone, code);

  const { customer, isNew } = await findOrCreateByPhone(phone);
  await createCustomerSession(customer.id, { ip, userAgent });

  const addresses = await listAddresses(customer.id);

  return ok({
    user: toUser(customer),
    addresses,
    // The existing UI shows the "complete your account" step whenever the
    // profile has no name yet — which covers both a brand-new account and one
    // that was created by an administrator without a name.
    needsProfile: isNew || !customer.firstName || !customer.lastName,
  });
});
