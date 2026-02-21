import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import type { InventoryPermission, InventoryRequestContext } from "@/modules/inventory/domain/types";
import { InventoryError } from "@/modules/inventory/domain/errors";
import { getInventoryRequestContext } from "@/modules/inventory/interface/context";
import { assertInventoryPermissionForContext } from "@/modules/inventory/interface/permissions";

async function buildInventoryPageRequest(): Promise<Request> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const requestHeaders = new Headers();

  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${encodeURIComponent(entry.value)}`)
    .join("; ");
  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
  }

  const requestId = headerStore.get("x-request-id") ?? crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);

  const userAgent = headerStore.get("user-agent");
  if (userAgent) {
    requestHeaders.set("user-agent", userAgent);
  }

  return new Request("http://inventory.local/internal/page-context", {
    headers: requestHeaders,
  });
}

export async function getInventoryPageContext(
  permission: InventoryPermission,
): Promise<InventoryRequestContext> {
  try {
    const request = await buildInventoryPageRequest();
    const ctx = await getInventoryRequestContext(request);
    assertInventoryPermissionForContext(ctx, permission);
    return ctx;
  } catch (error) {
    if (error instanceof InventoryError) {
      if (error.code === "UNAUTHORIZED") {
        redirect("/auth/sign-in");
      }
      if (error.code === "FORBIDDEN") {
        forbidden();
      }
    }

    throw error;
  }
}

export async function getInventoryPageContextAuthenticated(): Promise<InventoryRequestContext> {
  try {
    const request = await buildInventoryPageRequest();
    return await getInventoryRequestContext(request);
  } catch (error) {
    if (error instanceof InventoryError && error.code === "UNAUTHORIZED") {
      redirect("/auth/sign-in");
    }
    throw error;
  }
}
