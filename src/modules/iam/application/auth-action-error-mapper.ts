import { Prisma } from "@prisma/client";
import { isIamError } from "@/modules/iam/domain/errors";
import type { AuthActionError } from "@/modules/iam/interface/action-error";

type MapAuthActionErrorInput = {
  error: unknown;
  requestId: string;
  isProduction: boolean;
};

const AUTH_RECOVERY_COMMAND = "npm run prisma:seed && npm run iam:backfill";

export function createValidationAuthActionError(message: string, requestId: string): AuthActionError {
  return {
    code: "VALIDATION_ERROR",
    message,
    requestId,
  };
}

export function createSetupRequiredAuthActionError(input: { requestId: string; isProduction: boolean }): AuthActionError {
  if (input.isProduction) {
    return {
      code: "INTERNAL_ERROR",
      message: "Authentication is temporarily unavailable.",
      requestId: input.requestId,
    };
  }

  return {
    code: "SETUP_REQUIRED",
    message: `No users exist yet. Run: ${AUTH_RECOVERY_COMMAND}`,
    requestId: input.requestId,
  };
}

export function createDemoUserMissingAuthActionError(input: {
  requestId: string;
  isProduction: boolean;
  email: string;
}): AuthActionError {
  if (input.isProduction) {
    return {
      code: "INTERNAL_ERROR",
      message: "Authentication is temporarily unavailable.",
      requestId: input.requestId,
    };
  }

  return {
    code: "SETUP_REQUIRED",
    message: `Configured demo account ${input.email} is missing. Run: ${AUTH_RECOVERY_COMMAND}`,
    requestId: input.requestId,
  };
}

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export function mapAuthActionError(input: MapAuthActionErrorInput): AuthActionError {
  const { error, requestId, isProduction } = input;

  if (isIamError(error)) {
    if (!isProduction) {
      return {
        code: error.code,
        message: error.message,
        requestId,
        details: error.details ?? undefined,
      };
    }

    if (error.code === "UNAUTHORIZED") {
      return { code: "UNAUTHORIZED", message: "Invalid credentials", requestId };
    }
    if (error.code === "RATE_LIMITED") {
      return { code: "RATE_LIMITED", message: "Too many failed sign-in attempts. Try again later.", requestId };
    }
    if (error.code === "VALIDATION_ERROR") {
      return { code: "VALIDATION_ERROR", message: "Invalid authentication input", requestId };
    }
    if (error.code === "AUTH_METHOD_DISABLED" || error.code === "FORBIDDEN") {
      return { code: error.code, message: "Sign-in is not available for this account.", requestId };
    }
    return { code: "INTERNAL_ERROR", message: "Authentication is temporarily unavailable.", requestId };
  }

  if (isSchemaMismatch(error)) {
    if (!isProduction) {
      return {
        code: "SETUP_REQUIRED",
        message: "IAM database schema is outdated. Run prisma migrations and seed.",
        requestId,
      };
    }

    return {
      code: "INTERNAL_ERROR",
      message: "Authentication is temporarily unavailable.",
      requestId,
    };
  }

  if (!isProduction && error instanceof Error) {
    return {
      code: "INTERNAL_ERROR",
      message: error.message,
      requestId,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Authentication is temporarily unavailable.",
    requestId,
  };
}
