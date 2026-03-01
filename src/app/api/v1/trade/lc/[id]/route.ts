import { getLcDetail, updateLc } from "@/modules/trade/application/lc.service";
import { lcUpdateSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const { id } = await context.params;
    return jsonOk(await getLcDetail(ctx, id));
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { id } = await context.params;
    const payload = await parseJson(request, lcUpdateSchema);
    return jsonOk(await updateLc(ctx, id, payload));
  });
}
