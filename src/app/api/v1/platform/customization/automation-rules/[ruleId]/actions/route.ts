import { applyAutomationRuleAction } from "@/modules/platform/application/customization.service";
import { automationRuleActionSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ ruleId: string }> },
) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const { ruleId } = await context.params;
    const payload = await parseJson(request, automationRuleActionSchema);
    return jsonOk(await applyAutomationRuleAction(ctx, ruleId, payload));
  });
}
