import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { PlatformError, isPlatformError } from "@/modules/platform/domain/errors";
import type { PlatformPermission } from "@/modules/platform/domain/types";
import { getPlatformRequestContext } from "@/modules/platform/interface/context";
import { assertPlatformPermission } from "@/modules/platform/application/authorization.service";
import { logError } from "@/lib/logger";

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

export function jsonOk(data: unknown, init?: ResponseInit, requestId?: string): NextResponse {
  const response = NextResponse.json({ ok: true, data }, init);
  if (requestId) {
    response.headers.set("x-request-id", requestId);
  }
  return response;
}

export function jsonError(error: unknown, requestId?: string): NextResponse {
  const withRequestId = (response: NextResponse) => {
    if (requestId) {
      response.headers.set("x-request-id", requestId);
    }
    return response;
  };

  if (isPlatformError(error)) {
    return withRequestId(NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      },
      { status: error.status },
    ));
  }

  if (error instanceof ZodError) {
    return withRequestId(NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.flatten(),
        },
      },
      { status: 400 },
    ));
  }

  const message =
    process.env.NODE_ENV === "production"
      ? "Unexpected error"
      : error instanceof Error
        ? error.message
        : "Unexpected error";

  logError("platform api handler error", {
    requestId,
    module: "platform.interface.http",
    details: {
      message: error instanceof Error ? error.message : String(error),
    },
  });

  return withRequestId(NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
    { status: 500 },
  ));
}

export async function withPlatformAuth(
  request: Request,
  permission: PlatformPermission,
  handler: (ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const ctx = await getPlatformRequestContext(request);
    assertPlatformPermission(ctx, permission);
    const response = await handler(ctx);
    response.headers.set("x-request-id", ctx.requestId);
    if (ctx.responseHeaders) {
      for (const [key, value] of Object.entries(ctx.responseHeaders)) {
        response.headers.set(key, value);
      }
    }
    return response;
  } catch (error) {
    return jsonError(error, request.headers.get("x-request-id") ?? crypto.randomUUID());
  }
}
