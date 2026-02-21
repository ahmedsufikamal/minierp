import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryRequestContext } from "@/modules/inventory/interface/context";
import { assertInventoryPermissionForContext } from "@/modules/inventory/interface/permissions";
import { jsonError } from "@/modules/inventory/interface/http";
import { proxyStockSettingsToRust } from "@/modules/inventory/interface/rust-stock-settings-proxy";

function applyContextResponseHeaders(
  response: Response,
  headers: Record<string, string> | undefined,
): Response {
  if (!headers) return response;
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function GET(request: Request) {
  try {
    const ctx = await getInventoryRequestContext(request);
    const response = await proxyStockSettingsToRust({ request, ctx });
    return applyContextResponseHeaders(response, ctx.responseHeaders);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getInventoryRequestContext(request);
    assertInventoryPermissionForContext(ctx, inventoryPermissions.settingsWrite);
    const response = await proxyStockSettingsToRust({
      request,
      ctx,
      includeWritePermissionHeader: true,
    });
    return applyContextResponseHeaders(response, ctx.responseHeaders);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getInventoryRequestContext(request);
    assertInventoryPermissionForContext(ctx, inventoryPermissions.settingsWrite);
    const response = await proxyStockSettingsToRust({
      request,
      ctx,
      includeWritePermissionHeader: true,
    });
    return applyContextResponseHeaders(response, ctx.responseHeaders);
  } catch (error) {
    return jsonError(error);
  }
}
