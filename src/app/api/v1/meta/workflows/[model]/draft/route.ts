import { saveWorkflowDraft } from "@/modules/platform/application/meta-model.service";
import { metaWorkflowDraftSchema } from "@/modules/platform/domain/meta-master-schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request, context: { params: Promise<{ model: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaWrite, async (ctx) => {
    const { model } = await context.params;
    const payload = await parseJson(request, metaWorkflowDraftSchema);
    return jsonOk(await saveWorkflowDraft(ctx, model, payload), { status: 201 });
  });
}
