import { describe, expect, it, vi, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import type { SessionPayload } from "@/lib/legacy-session-token";
import { decryptSessionToken } from "@/lib/legacy-session-token";
import { verifySessionToken } from "@/modules/iam/infrastructure/session";

vi.mock("@/lib/legacy-session-token", () => ({
  decryptSessionToken: vi.fn(),
}));

vi.mock("@/modules/iam/infrastructure/session", () => ({
  verifySessionToken: vi.fn(),
}));

function makePrincipal(overrides: Partial<IamPrincipal> = {}): IamPrincipal {
  return {
    userId: "user-1",
    email: "user@example.com",
    name: "User",
    platformRole: "NONE",
    activeCompanyId: "company-1",
    membershipRole: "OWNER",
    userTypeLevel: 5,
    effectiveLevel: 5,
    activeMembershipStatus: "ACTIVE",
    permissions: [],
    sessionId: "iam-session-1",
    stepUpVerifiedAt: null,
    mfaRequired: false,
    mustResetPassword: false,
    ...overrides,
  };
}

function makeLegacyPayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    userId: "user-1",
    companyId: "company-1",
    email: "user@example.com",
    name: "User",
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function makeRequest(path: string, cookies: Record<string, string> = {}): NextRequest {
  const headers = new Headers();
  const cookieValue = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  if (cookieValue) {
    headers.set("cookie", cookieValue);
  }

  return {
    nextUrl: new URL(`http://localhost${path}`),
    headers,
    cookies: {
      get(name: string) {
        const value = cookies[name];
        return value ? { name, value } : undefined;
      },
    },
  } as unknown as NextRequest;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("proxy", () => {
  it("does not bounce auth routes in IAM v2 with only a stale legacy cookie", async () => {
    vi.stubEnv("IAM_V2_ENABLED", "1");
    vi.mocked(verifySessionToken).mockResolvedValue(null);

    const response = await proxy(makeRequest("/auth/sign-in", { session: "legacy-cookie" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(verifySessionToken).not.toHaveBeenCalled();
    expect(decryptSessionToken).not.toHaveBeenCalled();
  });

  it("bounces auth routes in IAM v2 when the IAM session is valid", async () => {
    vi.stubEnv("IAM_V2_ENABLED", "1");
    vi.mocked(verifySessionToken).mockResolvedValue(makePrincipal());

    const response = await proxy(makeRequest("/auth/sign-in", { iam_session: "iam-cookie" }));

    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(verifySessionToken).toHaveBeenCalledWith("iam-cookie");
  });

  it("does not bounce /auth/sign-up in IAM v2 when the IAM session is valid", async () => {
    vi.stubEnv("IAM_V2_ENABLED", "1");
    vi.mocked(verifySessionToken).mockResolvedValue(makePrincipal());

    const response = await proxy(makeRequest("/auth/sign-up", { iam_session: "iam-cookie" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(verifySessionToken).not.toHaveBeenCalled();
  });

  it("bounces auth routes in legacy mode when the legacy session is valid", async () => {
    vi.stubEnv("IAM_V2_ENABLED", "0");
    vi.mocked(decryptSessionToken).mockResolvedValue(makeLegacyPayload());

    const response = await proxy(makeRequest("/auth/sign-in", { session: "legacy-cookie" }));

    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(decryptSessionToken).toHaveBeenCalledWith("legacy-cookie");
  });

  it("protects the trade route family", async () => {
    vi.stubEnv("IAM_V2_ENABLED", "1");

    const response = await proxy(makeRequest("/trade/lc"));

    expect(response.headers.get("location")).toBe("http://localhost/auth/sign-in");
    expect(response.status).toBeGreaterThanOrEqual(300);
  });

  it("lets authenticated trade requests reach the app shell", async () => {
    vi.stubEnv("IAM_V2_ENABLED", "1");

    const response = await proxy(makeRequest("/trade/lc", { iam_session: "iam-cookie" }));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
