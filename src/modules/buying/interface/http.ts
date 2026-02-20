import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { PlatformError, isPlatformError } from "@/modules/platform/domain/errors";
import { getPlatformRequestContext } from "@/modules/platform/interface/context";
import { type BuyingPermission } from "@/modules/buying/domain/types";

const permissionAliases: Record<BuyingPermission, string[]> = {
  "buying.material-request.read": ["buying.read", "procurement.read"],
  "buying.material-request.write": ["buying.write", "procurement.write"],
  "buying.material-request.approve": ["buying.approve", "procurement.approve", "buying.write"],
  "buying.rfq.read": ["buying.read", "procurement.read"],
  "buying.rfq.write": ["buying.write", "procurement.write"],
  "buying.supplier-quotation.read": ["buying.read", "procurement.read"],
  "buying.supplier-quotation.write": ["buying.write", "procurement.write"],
  "buying.purchase-receipt.read": ["buying.read", "procurement.read", "inventory.read"],
  "buying.purchase-receipt.write": ["buying.write", "procurement.write", "inventory.write"],
  "buying.purchase-receipt.post": ["buying.approve", "procurement.approve", "inventory.approve", "inventory.write"],
  "buying.supplier-payment.read": ["buying.read", "procurement.read", "accounting.read", "finance.read"],
  "buying.supplier-payment.write": ["buying.write", "procurement.write", "accounting.write", "finance.write"],
  "buying.supplier-payment.post": ["buying.approve", "procurement.approve", "accounting.write", "finance.write"],
  "buying.payable.read": ["buying.read", "procurement.read", "accounting.read", "finance.read"],
};

function hasBuyingPermission(
  ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>,
  permission: BuyingPermission,
): boolean {
  if (ctx.platformRole === "SUPER_ADMIN") return true;
  if (ctx.permissions.includes(permission)) return true;
  const aliases = permissionAliases[permission] ?? [];
  return aliases.some((alias) => ctx.permissions.includes(alias));
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseQuery<T>(request: Request, schema: ZodSchema<T>): T {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid query params", parsed.error.flatten());
  }
  return parsed.data;
}

export function jsonOk(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(error: unknown): NextResponse {
  if (isPlatformError(error)) {
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

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unexpected error",
      },
    },
    { status: 500 },
  );
}

export async function withBuyingAuth(
  request: Request,
  permission: BuyingPermission,
  handler: (ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const ctx = await getPlatformRequestContext(request);
    if (!hasBuyingPermission(ctx, permission)) {
      throw new PlatformError("FORBIDDEN", `Missing permission: ${permission}`);
    }
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
