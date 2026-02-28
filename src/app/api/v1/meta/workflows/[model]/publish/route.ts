import { publishWorkflowDraft } from "@/modules/platform/application/meta-model.service";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request, context: { params: Promise<{ model: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaPublish, async (ctx) => {
    const { model } = await context.params;
    return jsonOk(await publishWorkflowDraft(ctx, model));
  });
}
