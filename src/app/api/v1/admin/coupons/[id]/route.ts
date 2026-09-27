import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteCoupon, updateCoupon } from "@/server/services/admin-discounts";
import { couponSchema } from "@/server/schemas/admin";

/** PATCH / DELETE /api/v1/admin/coupons/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, couponSchema.partial());
  const coupon = await updateCoupon(params.id, input);

  await audit({
    action: "coupon.update",
    entityType: "coupon",
    entityId: coupon.id,
    summary: `کد تخفیف «${coupon.code}» ویرایش شد`,
    meta: input as Record<string, unknown>,
  });

  return ok({ coupon });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  const result = await deleteCoupon(params.id);
  await audit({
    action: "coupon.archive",
    entityType: "coupon",
    entityId: params.id,
    summary: result.message,
  });
  return ok(result);
});
