export type PlatformErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class PlatformError extends Error {
  readonly code: PlatformErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: PlatformErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "PlatformError";
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

export function isPlatformError(error: unknown): error is PlatformError {
  return error instanceof PlatformError;
}
