import { applyInventoryReconciliation } from "@/modules/inventory/application/reconciliation.service";
import { reconciliationApplySchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.documentWrite, async (ctx) => {
    const payload = await parseJson(request, reconciliationApplySchema);
    return jsonOk(await applyInventoryReconciliation(ctx, payload), { status: 201 });
  });
}
