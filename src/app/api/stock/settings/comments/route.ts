import { InventoryError } from "@/modules/inventory/domain/errors";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { proxyStockSettingsCommentsToRust } from "@/modules/inventory/interface/rust-stock-settings-comments-proxy";
import { jsonError, withInventoryAuth } from "@/modules/inventory/interface/http";
import { getInventoryRequestContext } from "@/modules/inventory/interface/context";
import { assertInventoryPermissionForContext } from "@/modules/inventory/interface/permissions";

function requireStockSettingsLevelWrite(level: number | undefined) {
  if ((level ?? 3) < 4) {
    throw new InventoryError("FORBIDDEN", "Stock settings comments require level 4 or higher");
  }
}

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.settingsRead, async (ctx) =>
    proxyStockSettingsCommentsToRust({ request, ctx, endpoint: "comments" }),
  );
}

export async function POST(request: Request) {
  try {
    const ctx = await getInventoryRequestContext(request);
    assertInventoryPermissionForContext(ctx, inventoryPermissions.settingsRead);
    requireStockSettingsLevelWrite(ctx.userTypeLevel);
    const response = await proxyStockSettingsCommentsToRust({ request, ctx, endpoint: "comments" });
    if (ctx.responseHeaders) {
      Object.entries(ctx.responseHeaders).forEach(([key, value]) => response.headers.set(key, value));
    }
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
