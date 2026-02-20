import { applyOpportunityAction } from "@/modules/crm/application/opportunities.service";
import { opportunityActionSchema } from "@/modules/crm/domain/schemas";
import { crmPermissions } from "@/modules/crm/domain/types";
import { jsonOk, parseJson, withCrmAuth } from "@/modules/crm/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ opportunityId: string }> },
) {
  return withCrmAuth(request, crmPermissions.opportunityApprove, async (ctx) => {
    const { opportunityId } = await context.params;
    const payload = await parseJson(request, opportunityActionSchema);
    return jsonOk(await applyOpportunityAction(ctx, opportunityId, payload));
  });
}
