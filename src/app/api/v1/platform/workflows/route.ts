import { listWorkflowDefinitions, upsertWorkflowDefinition } from "@/modules/platform/application/workflow.service";
import { workflowDefinitionSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.workflowRead, async (ctx) => {
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") ?? undefined;
    return jsonOk(await listWorkflowDefinitions(ctx, entityType));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.workflowWrite, async (ctx) => {
    const payload = await parseJson(request, workflowDefinitionSchema);
    return jsonOk(await upsertWorkflowDefinition(ctx, payload), { status: 201 });
  });
}
