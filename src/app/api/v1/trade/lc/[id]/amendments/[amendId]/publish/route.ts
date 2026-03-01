import { publishLcAmendment } from "@/modules/trade/application/lc-amendments.service";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, withTradeAuth } from "@/modules/trade/interface/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; amendId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { id, amendId } = await context.params;
    return jsonOk(await publishLcAmendment(ctx, id, amendId));
  });
}
