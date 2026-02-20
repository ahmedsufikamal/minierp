import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { PlatformError, isPlatformError } from "@/modules/platform/domain/errors";
import { getPlatformRequestContext } from "@/modules/platform/interface/context";
import { type ProjectsPermission } from "@/modules/projects/domain/types";

const permissionAliases: Record<ProjectsPermission, string[]> = {
  "projects.project.read": ["projects.read", "project.read"],
  "projects.project.write": ["projects.write", "project.write"],
  "projects.project.approve": ["projects.approve", "projects.write"],
  "projects.task.read": ["projects.read", "project.read"],
  "projects.task.write": ["projects.write", "project.write"],
  "projects.task.approve": ["projects.approve", "projects.write"],
  "projects.timesheet.read": ["projects.read", "project.read"],
  "projects.timesheet.write": ["projects.write", "project.write"],
  "projects.timesheet.approve": ["projects.approve", "projects.write"],
};

function hasPermission(
  ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>,
  permission: ProjectsPermission,
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

export async function withProjectsAuth(
  request: Request,
  permission: ProjectsPermission,
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
