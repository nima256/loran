import { ok } from "@/server/lib/http";
import { adminRoute } from "@/server/lib/admin-route";
import { getProductEditorOptions } from "@/server/services/taxonomy";

/** GET /api/v1/admin/products/options — pickers for the product editor. */
export const GET = adminRoute(async () => ok(await getProductEditorOptions()));
