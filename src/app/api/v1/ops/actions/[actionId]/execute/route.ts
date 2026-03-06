import { executeWorkflowActionCommand } from "@/modules/platform/application/ops-ai.service";
import { executeWorkflowActionSchema } from "@/modules/platform/domain/ops-ai.schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import {
  jsonOk,
  parseJson,
  requireIdempotencyKeyHeader,
  withPlatformAuth,
} from "@/modules/platform/interface/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ actionId: string }> },
) {
  return withPlatformAuth(request, platformPermissions.reportingWrite, async (ctx) => {
    const { actionId } = await context.params;
    const payload = await parseJson(request, executeWorkflowActionSchema);
    const idempotencyKey = requireIdempotencyKeyHeader(request);
    return jsonOk(await executeWorkflowActionCommand(ctx, actionId, payload, idempotencyKey));
  });
}
