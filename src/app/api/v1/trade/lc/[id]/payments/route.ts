import { createLcPayment, listLcPayments } from "@/modules/trade/application/lc-finance.service";
import { lcPaymentCreateSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const { id } = await context.params;
    return jsonOk(await listLcPayments(ctx, id));
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { id } = await context.params;
    const payload = await parseJson(request, lcPaymentCreateSchema);
    return jsonOk(await createLcPayment(ctx, id, payload), { status: 201 });
  });
}
