import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { proxyStockWorkspaceToRust } from "@/modules/inventory/interface/rust-stock-workspace-proxy";

const originalRustApiBaseUrl = process.env.RUST_API_BASE_URL;
const originalTrustedProxySecret = process.env.RUST_TRUSTED_PROXY_SECRET;

const ctx: InventoryRequestContext = {
  requestId: "req-123",
  tenantId: "tenant-1",
  companyId: "company-1",
  userId: "user-1",
  userTypeLevel: 4,
  role: "INVENTORY_MANAGER",
  iamPermissions: ["inventory.item.read", "inventory.settings.read"],
};

describe("proxyStockWorkspaceToRust", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.RUST_API_BASE_URL = "https://rust.local";
    process.env.RUST_TRUSTED_PROXY_SECRET = "secret-1";
  });

  afterEach(() => {
    process.env.RUST_API_BASE_URL = originalRustApiBaseUrl;
    process.env.RUST_TRUSTED_PROXY_SECRET = originalTrustedProxySecret;
  });

  it("throws when RUST_API_BASE_URL is missing", async () => {
    process.env.RUST_API_BASE_URL = "";

    const request = new Request("https://app.local/api/stock/workspace/metrics");

    await expect(
      proxyStockWorkspaceToRust({
        request,
        ctx,
        pathSuffix: "metrics",
      }),
    ).rejects.toMatchObject<Partial<InventoryError>>({
      name: "InventoryError",
      code: "INTERNAL_ERROR",
      message: "RUST_API_BASE_URL is required for /api/stock/workspace/*",
    });
  });

  it("throws when RUST_TRUSTED_PROXY_SECRET is missing", async () => {
    process.env.RUST_TRUSTED_PROXY_SECRET = "";

    const request = new Request("https://app.local/api/stock/workspace/metrics");

    await expect(
      proxyStockWorkspaceToRust({
        request,
        ctx,
        pathSuffix: "metrics",
      }),
    ).rejects.toMatchObject<Partial<InventoryError>>({
      name: "InventoryError",
      code: "INTERNAL_ERROR",
      message: "RUST_TRUSTED_PROXY_SECRET is required for /api/stock/workspace/*",
    });
  });

  it("forwards request context and returns proxied response headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));

    const request = new Request("https://app.local/api/stock/workspace/warehouse-stock-value?days=30", {
      method: "GET",
      headers: {
        "x-custom": "custom-value",
      },
    });

    const response = await proxyStockWorkspaceToRust({
      request,
      ctx,
      pathSuffix: "warehouse-stock-value",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl.toString()).toBe("https://rust.local/api/stock/workspace/warehouse-stock-value?days=30");
    expect(calledInit.method).toBe("GET");

    const headers = new Headers(calledInit.headers);
    expect(headers.get("x-minierp-proxy-secret")).toBe("secret-1");
    expect(headers.get("x-minierp-company-id")).toBe(ctx.companyId);
    expect(headers.get("x-minierp-tenant-id")).toBe(ctx.tenantId);
    expect(headers.get("x-minierp-user-id")).toBe(ctx.userId);
    expect(headers.get("x-minierp-role")).toBe(ctx.role);
    expect(headers.get("x-minierp-user-level")).toBe("4");
    expect(headers.get("x-minierp-permissions")).toBe("inventory.item.read,inventory.settings.read");
    expect(headers.get("x-request-id")).toBe(ctx.requestId);
    expect(headers.get("x-forwarded-proto")).toBe("https");
    expect(headers.get("x-custom")).toBe("custom-value");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-rust-proxy")).toBe("1");
    expect(response.headers.get("x-request-id")).toBe(ctx.requestId);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
