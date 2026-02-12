export type IamErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BOT_PROTECTION_FAILED"
  | "MFA_REQUIRED"
  | "STEP_UP_REQUIRED"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "AUTH_METHOD_DISABLED"
  | "RECOVERY_CODE_INVALID"
  | "RECOVERY_CODE_USED"
  | "AUTO_JOIN_RULE_VIOLATION"
  | "IMPERSONATION_NOT_ALLOWED"
  | "PASSWORD_RESET_REQUIRED"
  | "FORBIDDEN_EMAIL_MISMATCH"
  | "INTERNAL_ERROR";

export class IamError extends Error {
  readonly code: IamErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: IamErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "IamError";
    this.code = code;
    this.details = details;
    this.status =
      code === "UNAUTHORIZED"
        ? 401
        : code === "FORBIDDEN"
          ? 403
          : code === "NOT_FOUND"
            ? 404
            : code === "VALIDATION_ERROR"
              ? 400
              : code === "CONFLICT"
                ? 409
                : code === "RATE_LIMITED"
                  ? 429
                  : code === "BOT_PROTECTION_FAILED"
                    ? 400
                    : code === "MFA_REQUIRED"
                      ? 428
                      : code === "STEP_UP_REQUIRED"
                        ? 428
                      : code === "TOKEN_EXPIRED"
                        ? 410
                        : code === "TOKEN_INVALID"
                          ? 400
                          : code === "AUTH_METHOD_DISABLED"
                            ? 403
                            : code === "RECOVERY_CODE_INVALID"
                              ? 400
                              : code === "RECOVERY_CODE_USED"
                                ? 409
                                : code === "AUTO_JOIN_RULE_VIOLATION"
                                  ? 403
                                  : code === "IMPERSONATION_NOT_ALLOWED"
                                    ? 403
                                    : code === "PASSWORD_RESET_REQUIRED"
                                      ? 428
                          : code === "FORBIDDEN_EMAIL_MISMATCH"
                            ? 403
                          : 500;
  }
}

export function isIamError(error: unknown): error is IamError {
  return error instanceof IamError;
}
