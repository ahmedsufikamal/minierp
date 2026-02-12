import { describe, expect, it, vi } from "vitest";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import type { SessionPayload } from "@/lib/legacy-session-token";
import {
  resolvePrincipalFromTokens,
  type PrincipalResolverDependencies,
} from "@/modules/iam/application/principal-resolver";

function makePrincipal(overrides: Partial<IamPrincipal> = {}): IamPrincipal {
  return {
    userId: "user-1",
    email: "user@example.com",
    name: "User",
    platformRole: "NONE",
    activeCompanyId: "org-1",
    membershipRole: "OWNER",
    permissions: ["admin.settings"],
    sessionId: "sess-1",
    stepUpVerifiedAt: null,
    mfaRequired: false,
    ...overrides,
  };
}

function makePayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    userId: "user-1",
    companyId: "org-1",
    email: "user@example.com",
    name: "User",
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function createDeps(): PrincipalResolverDependencies {
  return {
    verifyIamSessionToken: vi.fn(),
    decryptLegacySession: vi.fn(),
    loadLegacyPrincipal: vi.fn(),
  };
}

describe("principal resolver", () => {
  it("prefers IAM session when valid", async () => {
    const deps = createDeps();
    const iamPrincipal = makePrincipal({ sessionId: "iam-session" });
    vi.mocked(deps.verifyIamSessionToken).mockResolvedValue(iamPrincipal);

    const result = await resolvePrincipalFromTokens(
      {
        iamSessionToken: "iam-cookie",
        legacySessionToken: "legacy-cookie",
      },
      { allowLegacyFallback: true },
      deps,
    );

    expect(result.source).toBe("iam");
    expect(result.principal?.sessionId).toBe("iam-session");
    expect(deps.decryptLegacySession).not.toHaveBeenCalled();
    expect(deps.loadLegacyPrincipal).not.toHaveBeenCalled();
  });

  it("falls back to legacy session when IAM session is missing", async () => {
    const deps = createDeps();
    const payload = makePayload();
    const legacyPrincipal = makePrincipal({ sessionId: "legacy:user-1" });

    vi.mocked(deps.verifyIamSessionToken).mockResolvedValue(null);
    vi.mocked(deps.decryptLegacySession).mockResolvedValue(payload);
    vi.mocked(deps.loadLegacyPrincipal).mockResolvedValue(legacyPrincipal);

    const result = await resolvePrincipalFromTokens(
      {
        iamSessionToken: "invalid-iam",
        legacySessionToken: "legacy-cookie",
      },
      { allowLegacyFallback: true },
      deps,
    );

    expect(result.source).toBe("legacy");
    expect(result.principal?.membershipRole).toBe("OWNER");
    expect(result.legacyPayload?.companyId).toBe("org-1");
  });

  it("returns null principal when neither session is valid", async () => {
    const deps = createDeps();
    vi.mocked(deps.verifyIamSessionToken).mockResolvedValue(null);
    vi.mocked(deps.decryptLegacySession).mockResolvedValue(null);

    const result = await resolvePrincipalFromTokens(
      {
        iamSessionToken: "invalid-iam",
        legacySessionToken: "invalid-legacy",
      },
      { allowLegacyFallback: true },
      deps,
    );

    expect(result.source).toBeNull();
    expect(result.principal).toBeNull();
  });
});
