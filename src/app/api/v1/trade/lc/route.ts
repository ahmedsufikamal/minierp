import { createLc, listLcs } from "@/modules/trade/application/lc.service";
import { lcCreateSchema, lcListQuerySchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, parseQuery, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(request: Request) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const query = parseQuery(request, lcListQuerySchema);
    return jsonOk(await listLcs(ctx, query));
  });
}

export async function POST(request: Request) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const payload = await parseJson(request, lcCreateSchema);
    return jsonOk(await createLc(ctx, payload), { status: 201 });
  });
}
