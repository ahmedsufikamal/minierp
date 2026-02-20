import {
  createDunningNotice,
  listDunningNotices,
} from "@/modules/selling/application/receivables.service";
import {
  dunningNoticeCreateSchema,
  dunningNoticeListQuerySchema,
} from "@/modules/selling/domain/schemas";
import { sellingPermissions } from "@/modules/selling/domain/types";
import { jsonOk, parseJson, parseQuery, withSellingAuth } from "@/modules/selling/interface/http";

export async function GET(request: Request) {
  return withSellingAuth(request, sellingPermissions.dunningRead, async (ctx) => {
    const query = parseQuery(request, dunningNoticeListQuerySchema);
    return jsonOk(await listDunningNotices(ctx, query));
  });
}

export async function POST(request: Request) {
  return withSellingAuth(request, sellingPermissions.dunningWrite, async (ctx) => {
    const payload = await parseJson(request, dunningNoticeCreateSchema);
    return jsonOk(await createDunningNotice(ctx, payload), { status: 201 });
  });
}
