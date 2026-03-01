import { createLcAttachmentUpload } from "@/modules/trade/application/lc-attachments.service";
import { lcAttachmentUploadUrlSchema } from "@/modules/trade/domain/schemas";
import { tradePermissions } from "@/modules/trade/domain/types";
import { jsonOk, parseJson, withTradeAuth } from "@/modules/trade/interface/http";

export async function POST(request: Request) {
  return withTradeAuth(request, tradePermissions.lcWrite, async (ctx) => {
    const payload = await parseJson(request, lcAttachmentUploadUrlSchema);
    return jsonOk(await createLcAttachmentUpload(ctx, payload), { status: 201 });
  });
}
