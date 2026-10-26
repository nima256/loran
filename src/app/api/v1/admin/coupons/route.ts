import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createCoupon, listCoupons } from "@/server/services/admin-discounts";
import { couponSchema } from "@/server/schemas/admin";
import { paginationSchema } from "@/server/lib/validation";
import { z } from "zod";

/** GET / POST /api/v1/admin/coupons */

const filterSchema = paginationSchema.extend({
  q: z.string().max(60).optional(),
  status: z.enum(["active", "inactive", "expired", "archived"]).optional(),
});

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await listCoupons(filters));
});

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, couponSchema);
  const coupon = await createCoupon(input);

  await audit({
    action: "coupon.create",
    entityType: "coupon",
    entityId: coupon.id,
    summary: `کد تخفیف «${coupon.code}» ایجاد شد`,
    meta: { type: coupon.type, value: coupon.value },
  });

  return created({ coupon });
});
