import { updateLcBank } from "@/modules/trade/application/lc-settings.service";
import { lcBankPatchSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bankId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    const { bankId } = await context.params;
    const payload = await parseJson(request, lcBankPatchSchema);
    return jsonOk(await updateLcBank(ctx, bankId, payload));
  });
}
