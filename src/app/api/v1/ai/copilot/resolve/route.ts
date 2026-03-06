import { createCopilotResolutionDraft } from "@/modules/platform/application/ops-ai.service";
import { copilotResolveSchema } from "@/modules/platform/domain/ops-ai.schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.reportingWrite, async (ctx) => {
    const payload = await parseJson(request, copilotResolveSchema);
    return jsonOk(await createCopilotResolutionDraft(ctx, payload), { status: 201 });
  });
}
