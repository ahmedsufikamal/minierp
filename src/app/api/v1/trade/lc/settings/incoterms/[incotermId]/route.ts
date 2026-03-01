import { updateLcIncoterm } from "@/modules/trade/application/lc-settings.service";
import { lcIncotermPatchSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ incotermId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    const { incotermId } = await context.params;
    const payload = await parseJson(request, lcIncotermPatchSchema);
    return jsonOk(await updateLcIncoterm(ctx, incotermId, payload));
  });
}
