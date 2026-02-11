import { createWarehouse, listWarehouses } from "@/modules/inventory/application/warehouses.service";
import { warehouseSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) => {
    return jsonOk(await listWarehouses(ctx));
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsWrite, async (ctx) => {
    const payload = await parseJson(request, warehouseSchema);
    return jsonOk(await createWarehouse(ctx, payload), { status: 201 });
  });
}
