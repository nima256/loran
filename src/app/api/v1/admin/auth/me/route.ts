import { handler, ok } from "@/server/lib/http";
import { requireAdmin } from "@/server/lib/session";

/** GET /api/v1/admin/auth/me — 401 when not signed in, by design. */
export const GET = handler(async () => {
  const admin = await requireAdmin();
  return ok({ admin: { id: admin.id, email: admin.email, name: admin.name } });
});
