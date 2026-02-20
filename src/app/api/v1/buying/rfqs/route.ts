import { createRfq, listRfqs } from "@/modules/buying/application/rfqs.service";
import { rfqCreateSchema, rfqListQuerySchema } from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, parseQuery, withBuyingAuth } from "@/modules/buying/interface/http";

export async function GET(request: Request) {
  return withBuyingAuth(request, buyingPermissions.rfqRead, async (ctx) => {
    const query = parseQuery(request, rfqListQuerySchema);
    return jsonOk(await listRfqs(ctx, query));
  });
}

export async function POST(request: Request) {
  return withBuyingAuth(request, buyingPermissions.rfqWrite, async (ctx) => {
    const payload = await parseJson(request, rfqCreateSchema);
    return jsonOk(await createRfq(ctx, payload), { status: 201 });
  });
}
