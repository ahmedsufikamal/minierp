import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHeaders = vi.fn();
const mockRedirect = vi.fn();
const mockUserCount = vi.fn();
const mockUserFindUnique = vi.fn();
const mockAssertRateLimit = vi.fn();
const mockVerifyTurnstileToken = vi.fn();

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      count: mockUserCount,
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock("@/modules/iam/infrastructure/rate-limit", () => ({
  assertRateLimit: mockAssertRateLimit,
}));

vi.mock("@/modules/iam/infrastructure/turnstile", () => ({
  verifyTurnstileToken: mockVerifyTurnstileToken,
}));

vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  syncLegacyFromIamSession: vi.fn(),
}));

function buildSignInFormData(email: string): FormData {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", "irrelevant-password");
  return formData;
}

describe("signin action demo recovery guidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    process.env.IAM_V2_ENABLED = "1";
    process.env.SEED_OWNER_EMAIL = "owner@demo.local";
    process.env.SEED_MANAGER_EMAIL = "manager@demo.local";

    mockHeaders.mockResolvedValue({
      get(key: string) {
        if (key === "x-request-id") return "req-signin-1";
        return null;
      },
    });
  });

  it("returns SETUP_REQUIRED in non-production when configured demo user is missing", async () => {
    process.env.NODE_ENV = "development";
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCount.mockResolvedValue(1);

    const { signin } = await import("@/app/auth-actions");
    const state = await signin({}, buildSignInFormData("manager@demo.local"));

    expect(state).toEqual({
      error: {
        code: "SETUP_REQUIRED",
        message: "Configured demo account manager@demo.local is missing. Run: npm run prisma:seed && npm run iam:backfill",
        requestId: "req-signin-1",
      },
    });
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("sanitizes missing demo-user guidance in production", async () => {
    process.env.NODE_ENV = "production";
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCount.mockResolvedValue(1);

    const { signin } = await import("@/app/auth-actions");
    const state = await signin({}, buildSignInFormData("manager@demo.local"));

    expect(state).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication is temporarily unavailable.",
        requestId: "req-signin-1",
      },
    });
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
