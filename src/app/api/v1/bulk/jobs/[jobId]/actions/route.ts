import { applyBulkJobAction } from "@/modules/bulk/application/jobs.service";
import { bulkJobActionSchema } from "@/modules/bulk/domain/schemas";
import { bulkPermissions } from "@/modules/bulk/domain/types";
import { jsonOk, parseJson, withBulkAuth } from "@/modules/bulk/interface/http";

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  return withBulkAuth(request, bulkPermissions.jobRun, async (ctx) => {
    const { jobId } = await context.params;
    const payload = await parseJson(request, bulkJobActionSchema);
    return jsonOk(await applyBulkJobAction(ctx, jobId, payload));
  });
}
