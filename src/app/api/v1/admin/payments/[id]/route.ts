import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { listPaymentSettings, updatePaymentSetting } from "@/server/services/settings";
import { paymentSettingSchema } from "@/server/schemas/admin";

/**
 * PATCH /api/v1/admin/payments/[id]
 *
 * Business settings only. The schema enumerates the writable fields, so a
 * future form change cannot smuggle a gateway credential into the database.
 */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, paymentSettingSchema);
  const method = await updatePaymentSetting(params.id, input);

  await audit({
    action: "payment_setting.update",
    entityType: "payment_method",
    entityId: method.id,
    summary: `تنظیمات درگاه «${method.name}» ویرایش شد`,
    meta: { active: input.active },
  });

  return ok({ methods: await listPaymentSettings() });
});
