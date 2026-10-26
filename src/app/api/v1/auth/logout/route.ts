import { handler, ok } from "@/server/lib/http";
import { destroyCustomerSession } from "@/server/lib/session";

/** POST /api/v1/auth/logout — revokes the session server-side and clears the cookie. */
export const POST = handler(async () => {
  await destroyCustomerSession();
  return ok({ signedOut: true });
});
