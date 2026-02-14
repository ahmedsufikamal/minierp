import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  verifySession: vi.fn(),
}));

import { verifySession } from "@/lib/session";
import { authorizeServerActionPermission, hasServerActionPermission } from "@/lib/auth";

const verifySessionMock = vi.mocked(verifySession);
const originalIamV2 = process.env.IAM_V2_ENABLED;

afterEach(() => {
  verifySessionMock.mockReset();
  process.env.IAM_V2_ENABLED = originalIamV2;
});

describe("hasServerActionPermission", () => {
  it("allows IAM v2 permission when explicitly granted", () => {
    const allowed = hasServerActionPermission({
      role: "MEMBER",
      permissions: ["inventory.import.read"],
      iamPermission: "inventory.import.read",
      legacyPermission: "inventory:read",
      iamV2Enabled: true,
    });

    expect(allowed).toBe(true);
  });

  it("denies IAM v2 permission when not granted", () => {
    const allowed = hasServerActionPermission({
      role: "MEMBER",
      permissions: ["inventory.read"],
      iamPermission: "inventory.import.write",
      legacyPermission: "inventory:write",
      iamV2Enabled: true,
    });

    expect(allowed).toBe(false);
  });

  it("falls back to legacy permission mapping when IAM permissions are unavailable", () => {
    const allowed = hasServerActionPermission({
      role: "ADMIN",
      permissions: [],
      iamPermission: "inventory.import.write",
      legacyPermission: "inventory:write",
      iamV2Enabled: true,
    });

    expect(allowed).toBe(true);
  });

  it("keeps non-IAM mode behavior unchanged", () => {
    const allowed = hasServerActionPermission({
      role: "ADMIN",
      permissions: [],
      iamPermission: "inventory.import.write",
      legacyPermission: "inventory:write",
      iamV2Enabled: false,
    });

    expect(allowed).toBe(true);
  });
});

describe("authorizeServerActionPermission", () => {
  it("returns allowed context when IAM permission is present", async () => {
    process.env.IAM_V2_ENABLED = "1";
    verifySessionMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "MEMBER",
      permissions: ["inventory.import.read"],
    } as Awaited<ReturnType<typeof verifySession>>);

    const result = await authorizeServerActionPermission({
      iamPermission: "inventory.import.read",
      legacyPermission: "inventory:read",
    });

    expect(result.allowed).toBe(true);
    expect(result.context).toMatchObject({
      userId: "user-1",
      companyId: "company-1",
      role: "MEMBER",
      permissions: ["inventory.import.read"],
    });
  });

  it("returns denied when IAM permission is missing", async () => {
    process.env.IAM_V2_ENABLED = "1";
    verifySessionMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "MEMBER",
      permissions: ["inventory.import.read"],
    } as Awaited<ReturnType<typeof verifySession>>);

    const result = await authorizeServerActionPermission({
      iamPermission: "inventory.import.write",
      legacyPermission: "inventory:write",
    });

    expect(result.allowed).toBe(false);
    expect(result.context?.userId).toBe("user-1");
  });

  it("uses legacy fallback when session has no IAM permissions", async () => {
    process.env.IAM_V2_ENABLED = "1";
    verifySessionMock.mockResolvedValue({
      userId: "user-1",
      companyId: "company-1",
      role: "ADMIN",
      permissions: [],
    } as Awaited<ReturnType<typeof verifySession>>);

    const result = await authorizeServerActionPermission({
      iamPermission: "inventory.import.write",
      legacyPermission: "inventory:write",
    });

    expect(result.allowed).toBe(true);
  });

  it("uses user id as company fallback when company is missing", async () => {
    process.env.IAM_V2_ENABLED = "1";
    verifySessionMock.mockResolvedValue({
      userId: "user-2",
      role: "ADMIN",
      permissions: [],
    } as Awaited<ReturnType<typeof verifySession>>);

    const result = await authorizeServerActionPermission({
      iamPermission: "inventory.import.write",
      legacyPermission: "inventory:write",
    });

    expect(result.context?.companyId).toBe("user-2");
  });
});
