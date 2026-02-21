import { NextResponse } from "next/server";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

function resolveRustBaseUrl(): string | null {
  const raw = process.env.RUST_API_BASE_URL?.trim();
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function toPermissionsHeader(input: {
  granted: string[] | undefined;
  includeWrite: boolean;
}): string {
  const values = new Set<string>();
  (input.granted ?? []).forEach((permission) => {
    if (typeof permission === "string" && permission.trim().length > 0) {
      values.add(permission.trim());
    }
  });
  if (input.includeWrite) {
    values.add("inventory.settings.write");
  }
  return [...values].join(",");
}

export async function proxyStockSettingsToRust(params: {
  request: Request;
  ctx: InventoryRequestContext;
  includeWritePermissionHeader?: boolean;
}): Promise<NextResponse> {
  const baseUrl = resolveRustBaseUrl();
  if (!baseUrl) {
    throw new InventoryError("INTERNAL_ERROR", "RUST_API_BASE_URL is required for /api/stock/settings");
  }

  const sharedSecret = process.env.RUST_TRUSTED_PROXY_SECRET?.trim();
  if (!sharedSecret) {
    throw new InventoryError("INTERNAL_ERROR", "RUST_TRUSTED_PROXY_SECRET is required for /api/stock/settings");
  }

  const upstreamUrl = new URL(`${baseUrl}/api/stock/settings`);
  upstreamUrl.search = new URL(params.request.url).search;

  const headers = new Headers(params.request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-minierp-proxy-secret", sharedSecret);
  headers.set("x-minierp-company-id", params.ctx.companyId);
  headers.set("x-minierp-tenant-id", params.ctx.tenantId ?? params.ctx.companyId);
  headers.set("x-minierp-user-id", params.ctx.userId);
  headers.set("x-minierp-user-level", String(params.ctx.userTypeLevel ?? 3));
  headers.set("x-minierp-role", params.ctx.role);
  headers.set(
    "x-minierp-permissions",
    toPermissionsHeader({
      granted: params.ctx.iamPermissions,
      includeWrite: Boolean(params.includeWritePermissionHeader),
    }),
  );
  headers.set("x-request-id", params.ctx.requestId);
  headers.set("x-forwarded-proto", "https");

  const hasBody = params.request.method !== "GET" && params.request.method !== "HEAD";
  const body = hasBody ? await params.request.arrayBuffer() : undefined;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: params.request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    throw new InventoryError(
      "INTERNAL_ERROR",
      "Failed to reach Rust stock settings API",
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
