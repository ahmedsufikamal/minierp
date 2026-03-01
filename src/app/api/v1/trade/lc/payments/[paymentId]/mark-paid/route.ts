import { markLcPaymentPaid } from "@/modules/trade/application/lc-finance.service";
import { lcPaymentMarkPaidSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { paymentId } = await context.params;
    const payload = await parseJson(request, lcPaymentMarkPaidSchema);
    return jsonOk(await markLcPaymentPaid(ctx, paymentId, payload));
  });
}
