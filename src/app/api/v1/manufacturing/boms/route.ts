import { createBom, listBoms } from "@/modules/manufacturing/application/boms.service";
import { bomActionSchema, bomCreateSchema, bomListQuerySchema } from "@/modules/manufacturing/domain/schemas";
import { manufacturingPermissions } from "@/modules/manufacturing/domain/types";
import { jsonOk, parseJson, parseQuery, withManufacturingAuth } from "@/modules/manufacturing/interface/http";

export async function GET(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.bomRead, async (ctx) => {
    const query = parseQuery(request, bomListQuerySchema);
    return jsonOk(await listBoms(ctx, query));
  });
}

export async function POST(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.bomWrite, async (ctx) => {
    const payload = await parseJson(request, bomCreateSchema);
    return jsonOk(await createBom(ctx, payload), { status: 201 });
  });
}
