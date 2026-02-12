import { describe, expect, it } from "vitest";
import { buildOtpAuthUri, generateBase32Secret, generateTotp, verifyTotp } from "@/modules/iam/infrastructure/totp";

describe("totp", () => {
  it("generates and verifies TOTP", () => {
    const secret = generateBase32Secret();
    const code = generateTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it("rejects invalid code", () => {
    const secret = generateBase32Secret();
    expect(verifyTotp(secret, "000000")).toBe(false);
  });

  it("creates an otpauth URI", () => {
    const secret = generateBase32Secret();
    const uri = buildOtpAuthUri("miniERP", "user@example.com", secret);
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("issuer=miniERP");
  });
});
