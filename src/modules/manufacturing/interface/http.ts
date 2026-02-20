import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { PlatformError, isPlatformError } from "@/modules/platform/domain/errors";
import { getPlatformRequestContext } from "@/modules/platform/interface/context";
import { type ManufacturingPermission } from "@/modules/manufacturing/domain/types";

const permissionAliases: Record<ManufacturingPermission, string[]> = {
  "manufacturing.bom.read": ["manufacturing.read", "mfg.read"],
  "manufacturing.bom.write": ["manufacturing.write", "mfg.write"],
  "manufacturing.bom.approve": ["manufacturing.approve", "mfg.approve", "manufacturing.write"],
  "manufacturing.routing.read": ["manufacturing.read", "mfg.read"],
  "manufacturing.routing.write": ["manufacturing.write", "mfg.write"],
  "manufacturing.work-order.read": ["manufacturing.read", "mfg.read"],
  "manufacturing.work-order.write": ["manufacturing.write", "mfg.write"],
  "manufacturing.work-order.release": ["manufacturing.approve", "mfg.approve", "inventory.write"],
  "manufacturing.job-card.read": ["manufacturing.read", "mfg.read"],
  "manufacturing.job-card.write": ["manufacturing.write", "mfg.write"],
  "manufacturing.job-card.complete": ["manufacturing.approve", "mfg.approve", "quality.read"],
};

function hasPermission(
  ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>,
  permission: ManufacturingPermission,
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

export async function withManufacturingAuth(
  request: Request,
  permission: ManufacturingPermission,
  handler: (ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const ctx = await getPlatformRequestContext(request);
    if (!hasPermission(ctx, permission)) {
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
