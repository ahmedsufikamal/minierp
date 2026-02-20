import { createValidationRule } from "@/modules/platform/application/customization.service";
import { validationRuleSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.customizationWrite, async (ctx) => {
    const payload = await parseJson(request, validationRuleSchema);
    return jsonOk(await createValidationRule(ctx, payload), { status: 201 });
  });
}
