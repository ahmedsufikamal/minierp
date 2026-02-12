import type { BotProtectionPolicy, MfaPolicy, SessionPolicy } from "@/modules/iam/domain/types";

export const defaultSessionPolicy: SessionPolicy = {
  idleTimeoutMinutes: 30,
  absoluteTimeoutMinutes: 8 * 60,
  rememberMeAbsoluteTimeoutMinutes: 30 * 24 * 60,
  rotateEveryMinutes: 15,
};

export const defaultMfaPolicy: MfaPolicy = {
  mode: "OPTIONAL",
  enforceForRoles: ["OWNER", "ADMIN"],
  allowOtpFallback: true,
};

export const defaultBotProtectionPolicy: BotProtectionPolicy = {
  turnstileEnabled: false,
  rateLimitWindowSeconds: 60,
  rateLimitMaxAttempts: 8,
};

export function parseSessionPolicy(raw: unknown): SessionPolicy {
  if (!raw || typeof raw !== "object") return defaultSessionPolicy;
  const source = raw as Partial<SessionPolicy>;
  return {
    idleTimeoutMinutes: Number(source.idleTimeoutMinutes ?? defaultSessionPolicy.idleTimeoutMinutes),
    absoluteTimeoutMinutes: Number(source.absoluteTimeoutMinutes ?? defaultSessionPolicy.absoluteTimeoutMinutes),
    rememberMeAbsoluteTimeoutMinutes: Number(
      source.rememberMeAbsoluteTimeoutMinutes ?? defaultSessionPolicy.rememberMeAbsoluteTimeoutMinutes,
    ),
    rotateEveryMinutes: Number(source.rotateEveryMinutes ?? defaultSessionPolicy.rotateEveryMinutes),
  };
}

export function parseMfaPolicy(raw: unknown): MfaPolicy {
  if (!raw || typeof raw !== "object") return defaultMfaPolicy;
  const source = raw as Partial<MfaPolicy>;
  return {
    mode: (source.mode ?? defaultMfaPolicy.mode) as MfaPolicy["mode"],
    enforceForRoles: Array.isArray(source.enforceForRoles) ? source.enforceForRoles.map(String) : defaultMfaPolicy.enforceForRoles,
    allowOtpFallback: Boolean(source.allowOtpFallback ?? defaultMfaPolicy.allowOtpFallback),
  };
}

export function parseBotProtectionPolicy(raw: unknown): BotProtectionPolicy {
  if (!raw || typeof raw !== "object") return defaultBotProtectionPolicy;
  const source = raw as Partial<BotProtectionPolicy>;
  return {
    turnstileEnabled: Boolean(source.turnstileEnabled ?? defaultBotProtectionPolicy.turnstileEnabled),
    turnstileSecretKey: source.turnstileSecretKey,
    rateLimitWindowSeconds: Number(source.rateLimitWindowSeconds ?? defaultBotProtectionPolicy.rateLimitWindowSeconds),
    rateLimitMaxAttempts: Number(source.rateLimitMaxAttempts ?? defaultBotProtectionPolicy.rateLimitMaxAttempts),
  };
}

export function isMfaRequired(role: string, policy: MfaPolicy): boolean {
  if (policy.mode === "REQUIRED_FOR_ALL") return true;
  if (policy.mode === "REQUIRED_FOR_ADMINS") {
    return policy.enforceForRoles.includes(role);
  }
  return false;
}
