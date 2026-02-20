import { createAutomationRule, listAutomationRules } from "@/modules/platform/application/customization.service";
import { automationRuleListQuerySchema, automationRuleSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, automationRuleListQuerySchema);
    return jsonOk(await listAutomationRules(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, automationRuleSchema);
    return jsonOk(await createAutomationRule(ctx, payload), { status: 201 });
  });
}
