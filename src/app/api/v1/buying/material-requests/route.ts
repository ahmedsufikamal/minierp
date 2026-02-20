import { createMaterialRequest, listMaterialRequests } from "@/modules/buying/application/material-requests.service";
import {
  materialRequestCreateSchema,
  materialRequestListQuerySchema,
} from "@/modules/buying/domain/schemas";
import { buyingPermissions } from "@/modules/buying/domain/types";
import { jsonOk, parseJson, parseQuery, withBuyingAuth } from "@/modules/buying/interface/http";

export async function GET(request: Request) {
  return withBuyingAuth(request, buyingPermissions.materialRequestRead, async (ctx) => {
    const query = parseQuery(request, materialRequestListQuerySchema);
    return jsonOk(await listMaterialRequests(ctx, query));
  });
}

export async function POST(request: Request) {
  return withBuyingAuth(request, buyingPermissions.materialRequestWrite, async (ctx) => {
    const payload = await parseJson(request, materialRequestCreateSchema);
    return jsonOk(await createMaterialRequest(ctx, payload), { status: 201 });
  });
}
