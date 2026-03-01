import { updateLcChargeType } from "@/modules/trade/application/lc-settings.service";
import { lcChargeTypePatchSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ chargeTypeId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    const { chargeTypeId } = await context.params;
    const payload = await parseJson(request, lcChargeTypePatchSchema);
    return jsonOk(await updateLcChargeType(ctx, chargeTypeId, payload));
  });
}
