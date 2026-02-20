import { createBulkJob, listBulkJobs } from "@/modules/bulk/application/jobs.service";
import { bulkJobCreateSchema, bulkJobListQuerySchema } from "@/modules/bulk/domain/schemas";
import { bulkPermissions } from "@/modules/bulk/domain/types";
import { jsonOk, parseJson, parseQuery, withBulkAuth } from "@/modules/bulk/interface/http";

export async function GET(request: Request) {
  return withBulkAuth(request, bulkPermissions.jobRead, async (ctx) => {
    const query = parseQuery(request, bulkJobListQuerySchema);
    return jsonOk(await listBulkJobs(ctx, query));
  });
}

export async function POST(request: Request) {
  return withBulkAuth(request, bulkPermissions.jobWrite, async (ctx) => {
    const payload = await parseJson(request, bulkJobCreateSchema);
    return jsonOk(await createBulkJob(ctx, payload), { status: 201 });
  });
}
