import { NextResponse } from "next/server";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { resolveRustBaseUrl, resolveRustTrustedProxySecret } from "@/modules/inventory/interface/rust-proxy-env";

function toPermissionsHeader(granted: string[] | undefined): string {
  const values = new Set<string>();
  (granted ?? []).forEach((permission) => {
    if (typeof permission === "string" && permission.trim().length > 0) {
      values.add(permission.trim());
    }
  });
  return [...values].join(",");
}

export async function proxyStockItemsToRust(params: {
  request: Request;
  ctx: InventoryRequestContext;
}): Promise<NextResponse> {
  const baseUrl = resolveRustBaseUrl("/api/stock/items");
  const sharedSecret = resolveRustTrustedProxySecret("/api/stock/items");

  const upstreamUrl = new URL(`${baseUrl}/api/stock/items`);
  upstreamUrl.search = new URL(params.request.url).search;

  const headers = new Headers(params.request.headers);
  headers.delete("host");
  headers.delete("content-length");
  if (sharedSecret) {
    headers.set("x-minierp-proxy-secret", sharedSecret);
  }
  headers.set("x-minierp-company-id", params.ctx.companyId);
  headers.set("x-minierp-tenant-id", params.ctx.tenantId ?? params.ctx.companyId);
  headers.set("x-minierp-user-id", params.ctx.userId);
  headers.set("x-minierp-role", params.ctx.role);
  headers.set("x-minierp-user-level", String(params.ctx.userTypeLevel ?? 3));
  headers.set("x-minierp-permissions", toPermissionsHeader(params.ctx.iamPermissions));
  headers.set("x-request-id", params.ctx.requestId);
  headers.set("x-forwarded-proto", "https");

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (error) {
    throw new InventoryError(
      "INTERNAL_ERROR",
      "Failed to reach Rust stock items API",
      error instanceof Error ? { cause: error.message } : null,
    );
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.set("x-rust-proxy", "1");
  responseHeaders.set("x-request-id", params.ctx.requestId);

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
