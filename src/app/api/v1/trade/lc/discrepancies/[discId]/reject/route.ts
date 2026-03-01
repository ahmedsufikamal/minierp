import { rejectLcDiscrepancy } from "@/modules/trade/application/lc-discrepancies.service";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, withTradeAuth } from "@/modules/trade/interface/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ discId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { discId } = await context.params;
    return jsonOk(await rejectLcDiscrepancy(ctx, discId));
  });
}
