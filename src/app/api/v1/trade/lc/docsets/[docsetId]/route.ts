import { getLcDocset, updateLcDocset } from "@/modules/trade/application/lc-documents.service";
import { lcDocsetUpdateSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ docsetId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const { docsetId } = await context.params;
    return jsonOk(await getLcDocset(ctx, docsetId));
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ docsetId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { docsetId } = await context.params;
    const payload = await parseJson(request, lcDocsetUpdateSchema);
    return jsonOk(await updateLcDocset(ctx, docsetId, payload));
  });
}
