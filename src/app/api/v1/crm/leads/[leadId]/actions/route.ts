import { applyLeadAction } from "@/modules/crm/application/leads.service";
import { leadActionSchema } from "@/modules/crm/domain/schemas";
import { crmPermissions } from "@/modules/crm/domain/types";
import { jsonOk, parseJson, withCrmAuth } from "@/modules/crm/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  return withCrmAuth(request, crmPermissions.leadQualify, async (ctx) => {
    const { leadId } = await context.params;
    const payload = await parseJson(request, leadActionSchema);
    return jsonOk(await applyLeadAction(ctx, leadId, payload));
  });
}
