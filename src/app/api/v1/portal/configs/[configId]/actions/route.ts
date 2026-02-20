import { applyPortalConfigAction } from "@/modules/portal/application/configs.service";
import { portalConfigActionSchema } from "@/modules/portal/domain/schemas";
import { portalPermissions } from "@/modules/portal/domain/types";
import { jsonOk, parseJson, withPortalAuth } from "@/modules/portal/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ configId: string }> }) {
  return withPortalAuth(request, portalPermissions.configManage, async (ctx) => {
    const { configId } = await context.params;
    const payload = await parseJson(request, portalConfigActionSchema);
    return jsonOk(await applyPortalConfigAction(ctx, configId, payload));
  });
}
