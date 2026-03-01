import { createLcDiscrepancy, listLcDiscrepancies } from "@/modules/trade/application/lc-discrepancies.service";
import { lcDiscrepancyCreateSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const { id } = await context.params;
    return jsonOk(await listLcDiscrepancies(ctx, id));
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const { id } = await context.params;
    const payload = await parseJson(request, lcDiscrepancyCreateSchema);
    return jsonOk(await createLcDiscrepancy(ctx, id, payload), { status: 201 });
  });
}
