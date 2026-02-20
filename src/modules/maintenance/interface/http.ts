import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { PlatformError, isPlatformError } from "@/modules/platform/domain/errors";
import { getPlatformRequestContext } from "@/modules/platform/interface/context";
import { type MaintenancePermission } from "@/modules/maintenance/domain/types";

const permissionAliases: Record<MaintenancePermission, string[]> = {
  "maintenance.schedule.read": ["maintenance.read", "assets.read"],
  "maintenance.schedule.write": ["maintenance.write", "assets.write"],
  "maintenance.schedule.manage": ["maintenance.manage", "maintenance.write", "assets.write"],
  "maintenance.visit.read": ["maintenance.read", "assets.read"],
  "maintenance.visit.write": ["maintenance.write", "assets.write"],
};

function hasPermission(
  ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>,
  permission: MaintenancePermission,
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

export async function withMaintenanceAuth(
  request: Request,
  permission: MaintenancePermission,
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
