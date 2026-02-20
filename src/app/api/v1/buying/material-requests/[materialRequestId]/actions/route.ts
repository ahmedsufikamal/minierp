import { applyMaterialRequestAction } from "@/modules/buying/application/material-requests.service";
import { materialRequestActionSchema } from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, withBuyingAuth } from "@/modules/buying/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ materialRequestId: string }> },
) {
  return withBuyingAuth(request, buyingPermissions.materialRequestApprove, async (ctx) => {
    const { materialRequestId } = await context.params;
    const payload = await parseJson(request, materialRequestActionSchema);
    return jsonOk(await applyMaterialRequestAction(ctx, materialRequestId, payload));
  });
}
