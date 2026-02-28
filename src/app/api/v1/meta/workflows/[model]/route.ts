import { getWorkflowForModel } from "@/modules/platform/application/meta-model.service";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request, context: { params: Promise<{ model: string }> }) {
  return withPlatformAuth(request, platformPermissions.metaRead, async (ctx) => {
    const { model } = await context.params;
    return jsonOk(await getWorkflowForModel(ctx, model));
  });
}
