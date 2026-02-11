import { searchItemBySkuOrIdentifier } from "@/modules/inventory/application/items.service";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const code = new URL(request.url).searchParams.get("code") ?? "";
    if (!code.trim()) {
      throw new InventoryError("VALIDATION_ERROR", "code query param is required");
    }
    return jsonOk(await searchItemBySkuOrIdentifier(ctx, code));
  });
}
