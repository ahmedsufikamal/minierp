import { createRouting, listRoutings } from "@/modules/manufacturing/application/routings.service";
import { routingCreateSchema, routingListQuerySchema } from "@/modules/manufacturing/domain/schemas";
import { manufacturingPermissions } from "@/modules/manufacturing/domain/types";
import { jsonOk, parseJson, parseQuery, withManufacturingAuth } from "@/modules/manufacturing/interface/http";

export async function GET(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.routingRead, async (ctx) => {
    const query = parseQuery(request, routingListQuerySchema);
    return jsonOk(await listRoutings(ctx, query));
  });
}

export async function POST(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.routingWrite, async (ctx) => {
    const payload = await parseJson(request, routingCreateSchema);
    return jsonOk(await createRouting(ctx, payload), { status: 201 });
  });
}
