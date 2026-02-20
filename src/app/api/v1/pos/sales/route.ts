import { createPosSale, listPosSales } from "@/modules/pos/application/sales.service";
import { posSaleCreateSchema, posSaleListQuerySchema } from "@/modules/pos/domain/schemas";
import { posPermissions } from "@/modules/pos/domain/types";
import { jsonOk, parseJson, parseQuery, withPosAuth } from "@/modules/pos/interface/http";

export async function GET(request: Request) {
  return withPosAuth(request, posPermissions.saleRead, async (ctx) => {
    const query = parseQuery(request, posSaleListQuerySchema);
    return jsonOk(await listPosSales(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPosAuth(request, posPermissions.saleWrite, async (ctx) => {
    const payload = await parseJson(request, posSaleCreateSchema);
    return jsonOk(await createPosSale(ctx, payload), { status: 201 });
  });
}
