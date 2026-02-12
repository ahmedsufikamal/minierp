import { describe, expect, it } from "vitest";
import { hashToken, randomToken } from "@/modules/iam/infrastructure/crypto";

describe("invite token hashing", () => {
  it("produces stable hash for same input", () => {
    process.env.IAM_TOKEN_HASH_SECRET ||= "test_secret_for_hashing_123456789012345";
    const token = "abc123";
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces different hashes for different tokens", () => {
    process.env.IAM_TOKEN_HASH_SECRET ||= "test_secret_for_hashing_123456789012345";
    const first = hashToken(randomToken(16));
    const second = hashToken(randomToken(16));
    expect(first).not.toBe(second);
  });
});
