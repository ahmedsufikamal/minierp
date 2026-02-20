import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  verifySession: vi.fn(),
}));

vi.mock("@/modules/iam/application/principal-resolver", () => ({
  resolvePrincipalFromCookies: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { getCurrentUserSafe } from "@/lib/auth";
import { resolvePrincipalFromCookies } from "@/modules/iam/application/principal-resolver";
import { prisma } from "@/lib/prisma";

const resolvePrincipalFromCookiesMock = vi.mocked(resolvePrincipalFromCookies);
const findUniqueMock = vi.mocked(prisma.user.findUnique);

afterEach(() => {
  resolvePrincipalFromCookiesMock.mockReset();
  findUniqueMock.mockReset();
});

describe("getCurrentUserSafe", () => {
  it("returns null when request is unauthenticated without redirecting", async () => {
    resolvePrincipalFromCookiesMock.mockResolvedValue({
      principal: null,
      source: null,
      legacyPayload: null,
    });

    await expect(getCurrentUserSafe()).resolves.toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns current user when principal is present", async () => {
    resolvePrincipalFromCookiesMock.mockResolvedValue({
      principal: {
        userId: "user-1",
        email: "user@example.com",
        name: "User One",
        platformRole: "NONE",
        activeCompanyId: "company-1",
        membershipRole: "OWNER",
        permissions: [],
        sessionId: "session-1",
      },
      source: "iam",
      legacyPayload: null,
    });

    findUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User One",
      role: "OWNER",
      companyId: "company-1",
      platformRole: "NONE",
      activeCompanyId: "company-1",
      status: "ACTIVE",
      avatarUrl: null,
      phone: null,
      uiThemePreference: "SYSTEM",
      mustResetPassword: false,
    });

    const user = await getCurrentUserSafe();

    expect(user).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      activeCompanyId: "company-1",
      uiThemePreference: "SYSTEM",
    });
  });
});
