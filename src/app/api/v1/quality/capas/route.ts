import { createQualityCapa, listQualityCapas } from "@/modules/quality/application/capas.service";
import { qualityCapaCreateSchema, qualityCapaListQuerySchema } from "@/modules/quality/domain/schemas";
import { qualityPermissions } from "@/modules/quality/domain/types";
import { jsonOk, parseJson, parseQuery, withQualityAuth } from "@/modules/quality/interface/http";

export async function GET(request: Request) {
  return withQualityAuth(request, qualityPermissions.capaRead, async (ctx) => {
    const query = parseQuery(request, qualityCapaListQuerySchema);
    return jsonOk(await listQualityCapas(ctx, query));
  });
}

export async function POST(request: Request) {
  return withQualityAuth(request, qualityPermissions.capaWrite, async (ctx) => {
    const payload = await parseJson(request, qualityCapaCreateSchema);
    return jsonOk(await createQualityCapa(ctx, payload), { status: 201 });
  });
}
