import { createReorderRule, listReorderRules } from "@/modules/inventory/application/reorder.service";
import { reorderRuleSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    return jsonOk(await listReorderRules(ctx));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = await parseJson(request, reorderRuleSchema);
    return jsonOk(await createReorderRule(ctx, payload), { status: 201 });
  });
}
