import { getReorderSuggestions } from "@/modules/inventory/application/reorder.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    return jsonOk(await getReorderSuggestions(ctx));
  });
}
