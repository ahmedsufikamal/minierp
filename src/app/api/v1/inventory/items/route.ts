import { createInventoryItem, listInventoryItems } from "@/modules/inventory/application/items.service";
import { itemUpsertSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const data = await listInventoryItems(ctx, Object.fromEntries(new URL(request.url).searchParams.entries()));
    return jsonOk(data);
  });
}

export async function POST(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemWrite, async (ctx) => {
    const payload = await parseJson(request, itemUpsertSchema);
    const data = await createInventoryItem(ctx, payload);
    return jsonOk(data, { status: 201 });
  });
}
