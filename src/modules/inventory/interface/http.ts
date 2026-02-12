import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { assertInventoryPermission } from "@/modules/inventory/application/policy";
import { InventoryError, isInventoryError } from "@/modules/inventory/domain/errors";
import { type InventoryPermission } from "@/modules/inventory/domain/types";
import { getInventoryRequestContext } from "@/modules/inventory/interface/context";

const inventoryPermissionCompatibility: Record<InventoryPermission, string[]> = {
  "inventory.item.read": ["inventory.read"],
  "inventory.item.write": ["inventory.write"],
  "inventory.item.delete": ["inventory.write"],
  "inventory.document.read": ["inventory.read"],
  "inventory.document.write": ["inventory.write"],
  "inventory.document.approve": ["inventory.approve", "inventory.write"],
  "inventory.document.post": ["inventory.approve", "inventory.write"],
  "inventory.ledger.read": ["inventory.read"],
  "inventory.settings.read": ["inventory.read"],
  "inventory.settings.write": ["inventory.write"],
  "inventory.import.read": ["inventory.read"],
  "inventory.import.write": ["inventory.write"],
  "inventory.export.read": ["inventory.read"],
  "inventory.export.write": ["inventory.write"],
  "inventory.attachment.write": ["inventory.write"],
  "inventory.attachment.read": ["inventory.read"],
  "inventory.overrideNegativeStock": ["inventory.approve", "inventory.write"],
};

function isIamInventoryPermissionSyncEnabled(): boolean {
  const explicit = process.env.IAM_INVENTORY_PERMISSION_SYNC_ENABLED;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return true;
}

function hasIamInventoryPermission(granted: string[] | undefined, required: InventoryPermission): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes(required)) return true;
  const aliases = inventoryPermissionCompatibility[required] ?? [];
  return aliases.some((alias) => granted.includes(alias));
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseQuery<T>(request: Request, schema: ZodSchema<T>): T {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid query params", parsed.error.flatten());
  }
  return parsed.data;
}

export function jsonOk(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(error: unknown): NextResponse {
  if (isInventoryError(error)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
    { status: 500 },
  );
}

export async function withInventoryAuth(
  request: Request,
  permission: InventoryPermission,
  handler: (ctx: Awaited<ReturnType<typeof getInventoryRequestContext>>) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const ctx = await getInventoryRequestContext(request);
    if (isIamInventoryPermissionSyncEnabled() && Array.isArray(ctx.iamPermissions) && ctx.iamPermissions.length > 0) {
      if (!hasIamInventoryPermission(ctx.iamPermissions, permission)) {
        throw new InventoryError("FORBIDDEN", `Missing permission: ${permission}`);
      }
      const response = await handler(ctx);
      if (ctx.responseHeaders) {
        for (const [key, value] of Object.entries(ctx.responseHeaders)) {
          response.headers.set(key, value);
        }
      }
      return response;
    }
    assertInventoryPermission(ctx.role, permission);
    const response = await handler(ctx);
    if (ctx.responseHeaders) {
      for (const [key, value] of Object.entries(ctx.responseHeaders)) {
        response.headers.set(key, value);
      }
    }
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
