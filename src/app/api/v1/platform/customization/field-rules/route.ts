import {
  createPropertyOverrideRule,
  listPropertyOverrideRules,
} from "@/modules/platform/application/customization.service";
import {
  propertyOverrideRuleListQuerySchema,
  propertyOverrideRuleSchema,
} from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, parseQuery, withPlatformAuth } from "@/modules/platform/interface/http";

export async function GET(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationRead, async (ctx) => {
    const query = parseQuery(request, propertyOverrideRuleListQuerySchema);
    return jsonOk(await listPropertyOverrideRules(ctx, query));
  });
}

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, propertyOverrideRuleSchema);
    return jsonOk(await createPropertyOverrideRule(ctx, payload), { status: 201 });
  });
}
