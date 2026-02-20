import { upsertPermissionRule } from "@/modules/platform/application/tenants.service";
import { permissionRuleSchema } from "@/modules/platform/domain/schemas";
import { platformPermissions } from "@/modules/platform/domain/types";
import { jsonOk, parseJson, withPlatformAuth } from "@/modules/platform/interface/http";

export async function POST(request: Request) {
  return withPlatformAuth(request, platformPermissions.rbacWrite, async (ctx) => {
    const payload = await parseJson(request, permissionRuleSchema);
    return jsonOk(await upsertPermissionRule(ctx, payload), { status: 201 });
  });
}
