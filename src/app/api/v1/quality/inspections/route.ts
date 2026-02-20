import { createQualityInspection, listQualityInspections } from "@/modules/quality/application/inspections.service";
import { qualityInspectionCreateSchema, qualityInspectionListQuerySchema } from "@/modules/quality/domain/schemas";
import { qualityPermissions } from "@/modules/quality/domain/types";
import { jsonOk, parseJson, parseQuery, withQualityAuth } from "@/modules/quality/interface/http";

export async function GET(request: Request) {
  return withQualityAuth(request, qualityPermissions.inspectionRead, async (ctx) => {
    const query = parseQuery(request, qualityInspectionListQuerySchema);
    return jsonOk(await listQualityInspections(ctx, query));
  });
}

export async function POST(request: Request) {
  return withQualityAuth(request, qualityPermissions.inspectionWrite, async (ctx) => {
    const payload = await parseJson(request, qualityInspectionCreateSchema);
    return jsonOk(await createQualityInspection(ctx, payload), { status: 201 });
  });
}
