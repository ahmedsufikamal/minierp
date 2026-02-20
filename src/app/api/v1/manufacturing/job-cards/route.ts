import { createJobCard, listJobCards } from "@/modules/manufacturing/application/job-cards.service";
import { jobCardActionSchema, jobCardCreateSchema, jobCardListQuerySchema } from "@/modules/manufacturing/domain/schemas";
import { manufacturingPermissions } from "@/modules/manufacturing/domain/types";
import { jsonOk, parseJson, parseQuery, withManufacturingAuth } from "@/modules/manufacturing/interface/http";

export async function GET(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.jobCardRead, async (ctx) => {
    const query = parseQuery(request, jobCardListQuerySchema);
    return jsonOk(await listJobCards(ctx, query));
  });
}

export async function POST(request: Request) {
  return withManufacturingAuth(request, manufacturingPermissions.jobCardWrite, async (ctx) => {
    const payload = await parseJson(request, jobCardCreateSchema);
    return jsonOk(await createJobCard(ctx, payload), { status: 201 });
  });
}
