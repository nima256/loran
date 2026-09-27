import { handler, ok } from "@/server/lib/http";
import { getCustomer } from "@/server/lib/session";
import { listAddresses, getProfile } from "@/server/services/customers";

/**
 * GET /api/v1/auth/me — the session bootstrap the AuthProvider calls on mount.
 *
 * Returns `user: null` rather than 401 for a signed-out visitor: not being
 * signed in is a normal state for this endpoint, not an error.
 */
export const GET = handler(async () => {
  const identity = await getCustomer();
  if (!identity) return ok({ user: null, addresses: [] });

  const [user, addresses] = await Promise.all([
    getProfile(identity.id),
    listAddresses(identity.id),
  ]);
  return ok({ user, addresses });
});
