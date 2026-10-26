import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { listPaymentSettings } from "@/server/services/settings";

/**
 * GET /api/v1/admin/payments
 *
 * Reports whether each gateway's credentials are configured as a boolean. The
 * credentials themselves are server environment variables and are never sent
 * to a browser — see `services/settings`.
 */
export const GET = adminRoute(async () => ok({ methods: await listPaymentSettings() }));
