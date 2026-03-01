import { createLcDocumentType, listLcDocumentTypes } from "@/modules/trade/application/lc-settings.service";
import { lcDocumentTypeCreateSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(request: Request) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    return jsonOk(await listLcDocumentTypes(ctx));
  });
}

export async function POST(request: Request) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    const payload = await parseJson(request, lcDocumentTypeCreateSchema);
    return jsonOk(await createLcDocumentType(ctx, payload), { status: 201 });
  });
}
