import { closeLc } from "@/modules/trade/application/lc.service";
import { lcActionVersionSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcSettle, async (ctx) => {
    const { id } = await context.params;
    const payload = await parseJson(request, lcActionVersionSchema);
    return jsonOk(await closeLc(ctx, id, payload.version));
  });
}
