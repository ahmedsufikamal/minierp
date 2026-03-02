import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSessionToken, encryptSessionToken } from "@/lib/legacy-session-token";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("JWT_SECRET", "12345678901234567890123456789012");
});

describe("legacy session token", () => {
  it("round-trips the requested expiry", async () => {
    const expiresAt = new Date("2026-03-03T12:00:00.000Z");
    const token = await encryptSessionToken({
      userId: "user-1",
      companyId: "company-1",
      email: "user@example.com",
      name: "User",
      expiresAt,
    });

    const payload = await decryptSessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.expiresAt.toISOString()).toBe(expiresAt.toISOString());
  });

  it("rejects tokens that are already expired", async () => {
    const token = await encryptSessionToken({
      userId: "user-1",
      companyId: "company-1",
      email: "user@example.com",
      name: "User",
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(decryptSessionToken(token)).resolves.toBeNull();
  });
});
