import { applyPropertyOverrideRuleAction } from "@/modules/platform/application/customization.service";
import { propertyOverrideRuleActionSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ruleId: string }> },
) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const { ruleId } = await context.params;
    const payload = await parseJson(request, propertyOverrideRuleActionSchema);
    return jsonOk(await applyPropertyOverrideRuleAction(ctx, ruleId, payload));
  });
}
