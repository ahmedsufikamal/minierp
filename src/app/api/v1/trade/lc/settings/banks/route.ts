import { createLcBank, listLcBanks } from "@/modules/trade/application/lc-settings.service";
import { lcBankCreateSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(request: Request) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    return jsonOk(await listLcBanks(ctx));
  });
}

export async function POST(request: Request) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    const payload = await parseJson(request, lcBankCreateSchema);
    return jsonOk(await createLcBank(ctx, payload), { status: 201 });
  });
}
