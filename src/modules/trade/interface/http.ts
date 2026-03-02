import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { PlatformError, isPlatformError } from "@/modules/platform/domain/errors";
import { getPlatformRequestContext } from "@/modules/platform/interface/context";
import { hasTradePermission, type TradePermission } from "@/modules/trade/domain/types";

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

export function jsonCsv(body: string, filename: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function jsonError(error: unknown, requestId?: string): NextResponse {
  const response = isPlatformError(error)
    ? NextResponse.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? null,
          },
        },
        { status: error.status },
      )
    : error instanceof ZodError
      ? NextResponse.json(
          {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              details: error.flatten(),
            },
          },
          { status: 400 },
        )
      : NextResponse.json(
          {
            ok: false,
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "Unexpected error",
            },
          },
          { status: 500 },
        );

  if (requestId) {
    response.headers.set("x-request-id", requestId);
  }
  return response;
}

export async function withTradeAuth(
  request: Request,
  permission: TradePermission,
  handler: (ctx: Awaited<ReturnType<typeof getPlatformRequestContext>>) => Promise<NextResponse>,
): Promise<NextResponse> {
  const fallbackRequestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const ctx = await getPlatformRequestContext(request);
    if (!hasTradePermission(ctx, permission)) {
      throw new PlatformError("FORBIDDEN", `Missing permission: ${permission}`);
    }
    const response = await handler(ctx);
    response.headers.set("x-request-id", ctx.requestId);
    if (ctx.responseHeaders) {
      for (const [key, value] of Object.entries(ctx.responseHeaders)) {
        response.headers.set(key, value);
      }
    }
    return response;
  } catch (error) {
    return jsonError(error, fallbackRequestId);
  }
}
