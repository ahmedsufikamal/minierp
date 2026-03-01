import { getLcAttachmentDownload } from "@/modules/trade/application/lc-attachments.service";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, withTradeAuth } from "@/modules/trade/interface/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ attachmentId: string }> },
) {
  return withTradeAuth(request, tradePermissions.lcRead, async (ctx) => {
    const { attachmentId } = await context.params;
    return jsonOk(await getLcAttachmentDownload(ctx, attachmentId));
  });
}
