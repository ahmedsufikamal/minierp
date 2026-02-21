import { NextResponse } from "next/server";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";

function toPermissionsHeader(input: { granted: string[] | undefined }): string {
  const values = new Set<string>();
  (input.granted ?? []).forEach((permission) => {
    if (typeof permission === "string" && permission.trim().length > 0) {
      values.add(permission.trim());
    }
  });
  return [...values].join(",");
}

function resolveRustBaseUrl(): string | null {
  const raw = process.env.RUST_API_BASE_URL?.trim();
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function isRustInventoryItemsEnabled(): boolean {
  return process.env.INVENTORY_ITEMS_RUST_ENABLED === "1";
}

export async function proxyInventoryItemsToRust(params: {
  request: Request;
  ctx: InventoryRequestContext;
  pathSuffix?: string;
}): Promise<NextResponse> {
  const baseUrl = resolveRustBaseUrl();
  if (!baseUrl) {
    throw new InventoryError("INTERNAL_ERROR", "RUST_API_BASE_URL is required when INVENTORY_ITEMS_RUST_ENABLED=1");
  }

  const sharedSecret = process.env.RUST_TRUSTED_PROXY_SECRET?.trim();
  if (!sharedSecret) {
    throw new InventoryError(
      "INTERNAL_ERROR",
      "RUST_TRUSTED_PROXY_SECRET is required when INVENTORY_ITEMS_RUST_ENABLED=1",
    );
  }

  const basePath = params.pathSuffix
    ? `/api/v1/inventory/items/${params.pathSuffix}`
    : "/api/v1/inventory/items";
  const upstreamUrl = new URL(`${baseUrl}${basePath}`);
  upstreamUrl.search = new URL(params.request.url).search;

  const headers = new Headers(params.request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-minierp-proxy-secret", sharedSecret);
  headers.set("x-minierp-company-id", params.ctx.companyId);
  headers.set("x-minierp-tenant-id", params.ctx.tenantId ?? params.ctx.companyId);
  headers.set("x-minierp-user-id", params.ctx.userId);
  headers.set("x-minierp-role", params.ctx.role);
  headers.set("x-minierp-user-level", String(params.ctx.userTypeLevel ?? 3));
  headers.set("x-minierp-permissions", toPermissionsHeader({ granted: params.ctx.iamPermissions }));
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
      "Failed to reach Rust inventory API",
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
