import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { proxyStockItemsToRust } from "@/modules/inventory/interface/rust-stock-items-proxy";
import { withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) =>
    proxyStockItemsToRust({ request, ctx }),
  );
}
