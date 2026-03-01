import { listTradeLcSettings, updateTradeLcSettings } from "@/modules/trade/application/lc-settings.service";
import { lcSettingsPatchSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(request: Request) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    return jsonOk(await listTradeLcSettings(ctx));
  });
}

export async function PATCH(request: Request) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    const payload = await parseJson(request, lcSettingsPatchSchema);
    return jsonOk(await updateTradeLcSettings(ctx, payload));
  });
}
