import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { proxyStockSettingsCommentsToRust } from "@/modules/inventory/interface/rust-stock-settings-comments-proxy";
import { withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) =>
    proxyStockSettingsCommentsToRust({ request, ctx, endpoint: "activity" }),
  );
}
