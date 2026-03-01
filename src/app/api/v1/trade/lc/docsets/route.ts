import { listAllLcDocsets } from "@/modules/trade/application/lc-documents.service";
import { lcDocsetListQuerySchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseQuery, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(request: Request) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const query = parseQuery(request, lcDocsetListQuerySchema);
    return jsonOk(await listAllLcDocsets(ctx, query));
  });
}
