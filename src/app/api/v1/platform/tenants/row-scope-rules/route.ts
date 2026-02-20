import { upsertRowScopeRule } from "@/modules/platform/application/tenants.service";
import { rowScopeRuleSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.rbacWrite, async (ctx) => {
    const payload = await parseJson(request, rowScopeRuleSchema);
    return jsonOk(await upsertRowScopeRule(ctx, payload), { status: 201 });
  });
}
