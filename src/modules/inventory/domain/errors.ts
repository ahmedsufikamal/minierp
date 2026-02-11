export type InventoryErrorCode =
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export class InventoryError extends Error {
  readonly code: InventoryErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: InventoryErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "InventoryError";
    this.code = code;
    this.details = details;
    this.status =
      code === "VALIDATION_ERROR"
        ? 400
        : code === "UNAUTHORIZED"
          ? 401
          : code === "FORBIDDEN"
            ? 403
            : code === "NOT_FOUND"
              ? 404
              : code === "CONFLICT"
                ? 409
                : 500;
  }
}

export function isInventoryError(error: unknown): error is InventoryError {
  return error instanceof InventoryError;
}
