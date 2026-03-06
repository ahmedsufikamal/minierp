import { describe, expect, it } from "vitest";
import { IamError } from "@/modules/iam/domain/errors";
import {
  createDemoUserMissingAuthActionError,
  createSetupRequiredAuthActionError,
  createValidationAuthActionError,
  mapAuthActionError,
} from "@/modules/iam/application/auth-action-error-mapper";

describe("auth action error mapper", () => {
  it("preserves exact IAM errors in non-production", () => {
    const mapped = mapAuthActionError({
      error: new IamError("FORBIDDEN", "User account is not active"),
      requestId: "req-1",
      isProduction: false,
    });

    expect(mapped).toEqual({
      code: "FORBIDDEN",
      message: "User account is not active",
      requestId: "req-1",
      details: undefined,
    });
  });

  it("sanitizes unauthorized errors in production", () => {
    const mapped = mapAuthActionError({
      error: new IamError("UNAUTHORIZED", "Invalid credentials"),
      requestId: "req-2",
      isProduction: true,
    });

    expect(mapped).toEqual({
      code: "UNAUTHORIZED",
      message: "Invalid credentials",
      requestId: "req-2",
    });
  });

  it("sanitizes forbidden/auth-method errors in production", () => {
    const mapped = mapAuthActionError({
      error: new IamError("AUTH_METHOD_DISABLED", "PASSWORD is disabled for this tenant"),
      requestId: "req-3",
      isProduction: true,
    });

    expect(mapped).toEqual({
      code: "AUTH_METHOD_DISABLED",
      message: "Sign-in is not available for this account.",
      requestId: "req-3",
    });
  });

  it("returns setup-required guidance for empty systems in non-production", () => {
    const mapped = createSetupRequiredAuthActionError({ requestId: "req-4", isProduction: false });
    expect(mapped.code).toBe("SETUP_REQUIRED");
    expect(mapped.message).toContain("npm run prisma:seed && npm run iam:backfill");
    expect(mapped.requestId).toBe("req-4");
  });

  it("sanitizes setup-required guidance in production", () => {
    const mapped = createSetupRequiredAuthActionError({ requestId: "req-5", isProduction: true });
    expect(mapped).toEqual({
      code: "INTERNAL_ERROR",
      message: "Authentication is temporarily unavailable.",
      requestId: "req-5",
    });
  });

  it("creates validation action errors with request correlation", () => {
    const mapped = createValidationAuthActionError("Invalid input", "req-6");
    expect(mapped).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      requestId: "req-6",
    });
  });

  it("returns non-production setup guidance for missing configured demo users", () => {
    const mapped = createDemoUserMissingAuthActionError({
      requestId: "req-7",
      isProduction: false,
      email: "manager@demo.local",
    });
    expect(mapped).toEqual({
      code: "SETUP_REQUIRED",
      message: "Configured demo account manager@demo.local is missing. Run: npm run prisma:seed && npm run iam:backfill",
      requestId: "req-7",
    });
  });

  it("sanitizes missing demo-user guidance in production", () => {
    const mapped = createDemoUserMissingAuthActionError({
      requestId: "req-8",
      isProduction: true,
      email: "manager@demo.local",
    });
    expect(mapped).toEqual({
      code: "INTERNAL_ERROR",
      message: "Authentication is temporarily unavailable.",
      requestId: "req-8",
    });
  });
});
