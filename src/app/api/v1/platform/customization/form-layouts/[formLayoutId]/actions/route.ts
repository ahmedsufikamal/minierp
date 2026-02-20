import { applyFormLayoutAction } from "@/modules/platform/application/customization.service";
import { formLayoutActionSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ formLayoutId: string }> },
) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const { formLayoutId } = await context.params;
    const payload = await parseJson(request, formLayoutActionSchema);
    return jsonOk(await applyFormLayoutAction(ctx, formLayoutId, payload));
  });
}
