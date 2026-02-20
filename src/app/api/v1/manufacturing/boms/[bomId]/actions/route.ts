import { applyBomAction } from "@/modules/manufacturing/application/boms.service";
import { bomActionSchema } from "@/modules/manufacturing/domain/schemas";
import { manufacturingPermissions } from "@/modules/manufacturing/domain/types";
import { jsonOk, parseJson, withManufacturingAuth } from "@/modules/manufacturing/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bomId: string }> },
) {
  return withManufacturingAuth(request, manufacturingPermissions.bomApprove, async (ctx) => {
    const { bomId } = await context.params;
    const payload = await parseJson(request, bomActionSchema);
    return jsonOk(await applyBomAction(ctx, bomId, payload));
  });
}
