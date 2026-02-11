import { deleteReorderRule, updateReorderRule } from "@/modules/inventory/application/reorder.service";
import { reorderRuleSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function PATCH(request: Request, props: { params: Promise<{ ruleId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { ruleId } = await props.params;
    const payload = await parseJson(request, reorderRuleSchema.partial());
    return jsonOk(await updateReorderRule(ctx, ruleId, payload));
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ ruleId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { ruleId } = await props.params;
    await deleteReorderRule(ctx, ruleId);
    return jsonOk({ deleted: true });
  });
}
