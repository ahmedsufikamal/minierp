import { updateLcDocumentType } from "@/modules/trade/application/lc-settings.service";
import { lcDocumentTypePatchSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentTypeId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcAdmin, async (ctx) => {
    const { documentTypeId } = await context.params;
    const payload = await parseJson(request, lcDocumentTypePatchSchema);
    return jsonOk(await updateLcDocumentType(ctx, documentTypeId, payload));
  });
}
