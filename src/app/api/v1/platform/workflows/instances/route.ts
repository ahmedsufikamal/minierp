import { applyWorkflowAction, startWorkflowInstance } from "@/modules/platform/application/workflow.service";
import { workflowActionSchema, workflowStartSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.workflowWrite, async (ctx) => {
    const payload = await parseJson(request, workflowStartSchema);
    return jsonOk(await startWorkflowInstance(ctx, payload), { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return withPlatformAuth(request, platformPermissions.workflowWrite, async (ctx) => {
    const payload = await parseJson(request, workflowActionSchema);
    return jsonOk(await applyWorkflowAction(ctx, payload));
  });
}
