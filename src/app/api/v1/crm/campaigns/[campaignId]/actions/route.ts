import { applyCampaignAction } from "@/modules/crm/application/campaigns.service";
import { campaignActionSchema } from "@/modules/crm/domain/schemas";
import { crmPermissions } from "@/modules/crm/domain/types";
import { jsonOk, parseJson, withCrmAuth } from "@/modules/crm/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  return withCrmAuth(request, crmPermissions.campaignWrite, async (ctx) => {
    const { campaignId } = await context.params;
    const payload = await parseJson(request, campaignActionSchema);
    return jsonOk(await applyCampaignAction(ctx, campaignId, payload));
  });
}
