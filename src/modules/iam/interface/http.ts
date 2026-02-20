import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { IamError, isIamError } from "@/modules/iam/domain/errors";
import { logError } from "@/lib/logger";

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new IamError("VALIDATION_ERROR", "Invalid payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseSearch<T>(request: Request, schema: ZodSchema<T>): T {
  const url = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    throw new IamError("VALIDATION_ERROR", "Invalid query", parsed.error.flatten());
  }
  return parsed.data;
}

export function ok(data: unknown, init?: ResponseInit, requestId?: string): NextResponse {
  const response = NextResponse.json({ ok: true, data }, init);
  if (requestId) {
    response.headers.set("x-request-id", requestId);
  }
  return response;
}

export function err(error: unknown, requestId?: string): NextResponse {
  const withRequestId = (response: NextResponse) => {
    if (requestId) {
      response.headers.set("x-request-id", requestId);
    }
    return response;
  };

  if (isIamError(error)) {
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
  logError("iam api handler error", {
    requestId,
    module: "iam.interface.http",
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
