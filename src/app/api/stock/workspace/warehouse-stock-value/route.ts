import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { proxyStockWorkspaceToRust } from "@/modules/inventory/interface/rust-stock-workspace-proxy";
import { withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) =>
    proxyStockWorkspaceToRust({ request, ctx, pathSuffix: "warehouse-stock-value" }),
  );
}
