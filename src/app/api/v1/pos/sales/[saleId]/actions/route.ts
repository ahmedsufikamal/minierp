import { applyPosSaleAction } from "@/modules/pos/application/sales.service";
import { posSaleActionSchema } from "@/modules/pos/domain/schemas";
import { posPermissions } from "@/modules/pos/domain/types";
import { jsonOk, parseJson, withPosAuth } from "@/modules/pos/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ saleId: string }> }) {
  return withPosAuth(request, posPermissions.salePay, async (ctx) => {
    const { saleId } = await context.params;
    const payload = await parseJson(request, posSaleActionSchema);
    return jsonOk(await applyPosSaleAction(ctx, saleId, payload));
  });
}
