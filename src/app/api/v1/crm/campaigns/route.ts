import { createCampaign, listCampaigns } from "@/modules/crm/application/campaigns.service";
import { campaignCreateSchema, campaignListQuerySchema } from "@/modules/crm/domain/schemas";
import { crmPermissions } from "@/modules/crm/domain/types";
import { jsonOk, parseJson, parseQuery, withCrmAuth } from "@/modules/crm/interface/http";

export async function GET(request: Request) {
  return withCrmAuth(request, crmPermissions.campaignRead, async (ctx) => {
    const query = parseQuery(request, campaignListQuerySchema);
    return jsonOk(await listCampaigns(ctx, query));
  });
}

export async function POST(request: Request) {
  return withCrmAuth(request, crmPermissions.campaignWrite, async (ctx) => {
    const payload = await parseJson(request, campaignCreateSchema);
    return jsonOk(await createCampaign(ctx, payload), { status: 201 });
  });
}
