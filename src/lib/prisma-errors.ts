import { Prisma } from "@prisma/client";

/**
 * Map Prisma unique constraint (P2002) to a field error for ActionResult.
 * Pass the field name that is duplicated (e.g. "sku", "number", "code").
 */
export function handlePrismaUniqueConflict(
  error: unknown,
  fieldName: string,
): { ok: false; error: Record<string, string[]> } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      ok: false,
      error: { [fieldName]: ["Already exists"] },
    };
  }
  return null;
}
