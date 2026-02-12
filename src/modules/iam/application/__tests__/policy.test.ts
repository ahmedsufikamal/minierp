import { describe, expect, it } from "vitest";
import {
  defaultMfaPolicy,
  defaultSessionPolicy,
  isMfaRequired,
  parseBotProtectionPolicy,
  parseMfaPolicy,
  parseSessionPolicy,
} from "@/modules/iam/application/policy";

describe("iam policy", () => {
  it("parses session policy with defaults", () => {
    const result = parseSessionPolicy({ idleTimeoutMinutes: 45 });
    expect(result.idleTimeoutMinutes).toBe(45);
    expect(result.absoluteTimeoutMinutes).toBe(defaultSessionPolicy.absoluteTimeoutMinutes);
  });

  it("parses MFA policy", () => {
    const result = parseMfaPolicy({ mode: "REQUIRED_FOR_ALL", enforceForRoles: ["OWNER"], allowOtpFallback: false });
    expect(result.mode).toBe("REQUIRED_FOR_ALL");
    expect(result.allowOtpFallback).toBe(false);
  });

  it("requires mfa for configured admin roles", () => {
    const policy = parseMfaPolicy({ mode: "REQUIRED_FOR_ADMINS", enforceForRoles: ["OWNER", "ADMIN"] });
    expect(isMfaRequired("OWNER", policy)).toBe(true);
    expect(isMfaRequired("VIEWER", policy)).toBe(false);
  });

  it("uses bot defaults", () => {
    const policy = parseBotProtectionPolicy(null);
    expect(policy.turnstileEnabled).toBe(false);
  });

  it("keeps optional MFA as default", () => {
    expect(defaultMfaPolicy.mode).toBe("OPTIONAL");
  });
});
