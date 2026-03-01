import { verifyLcDocset } from "@/modules/trade/application/lc-documents.service";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, withTradeAuth } from "@/modules/trade/interface/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ docsetId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { docsetId } = await context.params;
    return jsonOk(await verifyLcDocset(ctx, docsetId));
  });
}
