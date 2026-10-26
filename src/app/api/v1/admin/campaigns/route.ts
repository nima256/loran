import { z } from "zod";
import { created, ok } from "@/server/lib/http";
import { adminBody, adminRoute } from "@/server/lib/admin-route";
import { createCampaign, listCampaigns } from "@/server/services/admin-discounts";
import { campaignSchema } from "@/server/schemas/admin";
import { paginationSchema } from "@/server/lib/validation";

/** GET / POST /api/v1/admin/campaigns */

const filterSchema = paginationSchema.extend({
  q: z.string().max(120).optional(),
  status: z.enum(["active", "scheduled", "ended", "inactive"]).optional(),
});

export const GET = adminRoute(async (request) => {
  const url = new URL(request.url);
  const filters = filterSchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await listCampaigns(filters));
});

export const POST = adminRoute(async (request, { audit }) => {
  const input = await adminBody(request, campaignSchema);
  const campaign = await createCampaign(input);

  await audit({
    action: "campaign.create",
    entityType: "campaign",
    entityId: campaign.id,
    summary: `کمپین «${campaign.name}» ایجاد شد`,
    meta: { type: campaign.type, value: campaign.value, products: input.productIds.length },
  });

  return created({ campaign });
});
