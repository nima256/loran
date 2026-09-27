import { handler, ok } from "@/server/lib/http";
import { destroyAdminSession, getAdmin } from "@/server/lib/session";
import { recordAudit } from "@/server/services/audit";

/** POST /api/v1/admin/auth/logout */
export const POST = handler(async () => {
  const admin = await getAdmin();
  if (admin) {
    await recordAudit({
      admin,
      action: "admin.logout",
      entityType: "admin",
      entityId: admin.id,
      summary: `خروج مدیر ${admin.email} از پنل`,
    });
  }
  await destroyAdminSession();
  return ok({ signedOut: true });
});
