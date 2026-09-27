import { ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { deleteCampaign, updateCampaign } from "@/server/services/admin-discounts";
import { campaignSchema } from "@/server/schemas/admin";

/** PATCH / DELETE /api/v1/admin/campaigns/[id] */

type Params = { id: string };

export const PATCH = adminRoute<Params>(async (request, { params, audit }) => {
  const input = await adminBody(request, campaignSchema.partial());
  const campaign = await updateCampaign(params.id, input);

  await audit({
    action: "campaign.update",
    entityType: "campaign",
    entityId: campaign.id,
    summary: `کمپین «${campaign.name}» ویرایش شد`,
  });

  return ok({ campaign });
});

export const DELETE = adminRoute<Params>(async (_request, { params, audit }) => {
  const result = await deleteCampaign(params.id);
  await audit({
    action: "campaign.delete",
    entityType: "campaign",
    entityId: params.id,
    summary: result.message,
  });
  return ok(result);
});
