import { createAutomationRun, listAutomationRuns } from "@/modules/platform/application/automation-runtime.service";
import { automationRunCreateSchema, automationRunListQuerySchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, automationRunListQuerySchema);
    return jsonOk(await listAutomationRuns(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, automationRunCreateSchema);
    return jsonOk(await createAutomationRun(ctx, payload), { status: 201 });
  });
}
