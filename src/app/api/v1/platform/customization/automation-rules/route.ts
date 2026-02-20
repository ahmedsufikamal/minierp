import { createAutomationRule } from "@/modules/platform/application/customization.service";
import { automationRuleSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, automationRuleSchema);
    return jsonOk(await createAutomationRule(ctx, payload), { status: 201 });
  });
}
