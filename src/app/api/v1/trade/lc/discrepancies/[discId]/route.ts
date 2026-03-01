import { updateLcDiscrepancy } from "@/modules/trade/application/lc-discrepancies.service";
import { lcDiscrepancyPatchSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ discId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { discId } = await context.params;
    const payload = await parseJson(request, lcDiscrepancyPatchSchema);
    return jsonOk(await updateLcDiscrepancy(ctx, discId, payload));
  });
}
