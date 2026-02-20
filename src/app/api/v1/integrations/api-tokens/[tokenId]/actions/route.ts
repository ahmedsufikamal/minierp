import { applyApiTokenAction } from "@/modules/integrations/application/tokens.service";
import { apiTokenActionSchema } from "@/modules/integrations/domain/schemas";
import { integrationsPermissions } from "@/modules/integrations/domain/types";
import { jsonOk, parseJson, withIntegrationsAuth } from "@/modules/integrations/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ tokenId: string }> }) {
  return withIntegrationsAuth(request, integrationsPermissions.tokenManage, async (ctx) => {
    const { tokenId } = await context.params;
    const payload = await parseJson(request, apiTokenActionSchema);
    return jsonOk(await applyApiTokenAction(ctx, tokenId, payload));
  });
}
