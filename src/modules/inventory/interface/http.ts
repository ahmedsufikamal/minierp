import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { assertInventoryPermission } from "@/modules/inventory/application/policy";
import { InventoryError, isInventoryError } from "@/modules/inventory/domain/errors";
import { type InventoryPermission } from "@/modules/inventory/domain/types";
import { getInventoryRequestContext } from "@/modules/inventory/interface/context";

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
    assertInventoryPermission(ctx.role, permission);
    return await handler(ctx);
  } catch (error) {
    return jsonError(error);
  }
}
