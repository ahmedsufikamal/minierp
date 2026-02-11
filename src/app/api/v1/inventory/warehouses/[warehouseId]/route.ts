import { archiveWarehouse, updateWarehouse } from "@/modules/inventory/application/warehouses.service";
import { warehouseSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function PATCH(request: Request, props: { params: Promise<{ warehouseId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { warehouseId } = await props.params;
    const payload = await parseJson(request, warehouseSchema.partial());
    return jsonOk(await updateWarehouse(ctx, warehouseId, payload));
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ warehouseId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { warehouseId } = await props.params;
    return jsonOk(await archiveWarehouse(ctx, warehouseId));
  });
}
