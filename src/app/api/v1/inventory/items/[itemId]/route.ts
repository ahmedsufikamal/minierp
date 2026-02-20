import { archiveInventoryItem, getInventoryItemById, updateInventoryItem } from "@/modules/inventory/application/items.service";
import { itemUpsertSchema } from "@/modules/inventory/application/schemas";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { isRustInventoryItemsEnabled, proxyInventoryItemsToRust } from "@/modules/inventory/interface/rust-items-proxy";
import { jsonOk, parseJson, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request, props: { params: Promise<{ itemId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const { itemId } = await props.params;
    if (isRustInventoryItemsEnabled()) {
      return proxyInventoryItemsToRust({ request, ctx, pathSuffix: itemId });
    }
    return jsonOk(await getInventoryItemById(ctx, itemId));
  });
}

export async function PATCH(request: Request, props: { params: Promise<{ itemId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.itemWrite, async (ctx) => {
    const { itemId } = await props.params;
    const payload = await parseJson(request, itemUpsertSchema.partial());
    return jsonOk(await updateInventoryItem(ctx, itemId, payload));
  });
}

export async function DELETE(request: Request, props: { params: Promise<{ itemId: string }> }) {
  return withInventoryAuth(request, inventoryPermissions.itemDelete, async (ctx) => {
    const { itemId } = await props.params;
    return jsonOk(await archiveInventoryItem(ctx, itemId));
  });
}
