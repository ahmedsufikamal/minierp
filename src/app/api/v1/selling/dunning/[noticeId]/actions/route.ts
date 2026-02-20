import { applyDunningNoticeAction } from "@/modules/selling/application/receivables.service";
import { dunningNoticeActionSchema } from "@/modules/selling/domain/schemas";
import { sellingPermissions } from "@/modules/selling/domain/types";
import { jsonOk, parseJson, withSellingAuth } from "@/modules/selling/interface/http";

type Params = {
  params: Promise<{ noticeId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  return withSellingAuth(request, sellingPermissions.dunningManage, async (ctx) => {
    const { noticeId } = await params;
    const payload = await parseJson(request, dunningNoticeActionSchema);
    return jsonOk(await applyDunningNoticeAction(ctx, noticeId, payload));
  });
}
