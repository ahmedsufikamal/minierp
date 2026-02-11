import { createWarehouseLocation } from "@/modules/inventory/application/warehouses.service";
import { locationSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = await parseJson(request, locationSchema);
    return jsonOk(await createWarehouseLocation(ctx, payload), { status: 201 });
  });
}
