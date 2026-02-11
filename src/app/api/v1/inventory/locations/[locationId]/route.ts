import { archiveWarehouseLocation, updateWarehouseLocation } from "@/modules/inventory/application/warehouses.service";
import { locationSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function PATCH(request: Request, props: { params: Promise<{ locationId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { locationId } = await props.params;
    const payload = await parseJson(request, locationSchema.partial());
    return jsonOk(await updateWarehouseLocation(ctx, locationId, payload));
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ locationId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const { locationId } = await props.params;
    return jsonOk(await archiveWarehouseLocation(ctx, locationId));
  });
}
