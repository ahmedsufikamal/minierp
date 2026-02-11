import { listWorkflowDefinitions, upsertWorkflowDefinition } from "@/modules/inventory/application/workflow.service";
import { workflowDefinitionSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) => {
    return jsonOk(await listWorkflowDefinitions(ctx));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = await parseJson(request, workflowDefinitionSchema);
    return jsonOk(await upsertWorkflowDefinition(ctx, payload), { status: 201 });
  });
}
