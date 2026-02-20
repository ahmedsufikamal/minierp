import { previewInventoryReconciliation } from "@/modules/inventory/application/reconciliation.service";
import { reconciliationPreviewSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const payload = await parseJson(request, reconciliationPreviewSchema);
    return jsonOk(await previewInventoryReconciliation(ctx, payload));
  });
}
