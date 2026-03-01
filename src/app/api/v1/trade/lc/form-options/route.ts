import { getLcFormOptions } from "@/modules/trade/application/lc.service";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(request: Request) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    return jsonOk(await getLcFormOptions(ctx));
  });
}
