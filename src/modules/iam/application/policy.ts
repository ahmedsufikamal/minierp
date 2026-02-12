import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import type { BotProtectionPolicy, MfaPolicy, SessionPolicy } from "@/modules/iam/domain/types";
import type { AuthMethod } from "@/modules/iam/domain/types";

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

export const defaultAllowedAuthMethods: AuthMethod[] = [
  "PASSWORD",
  "MAGIC_LINK",
  "OAUTH_GOOGLE",
  "OAUTH_MICROSOFT",
];

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

export function parseAllowedAuthMethods(raw: unknown): AuthMethod[] {
  if (!Array.isArray(raw)) return defaultAllowedAuthMethods;

  const allowed = raw
    .map((value) => String(value))
    .filter((value): value is AuthMethod =>
      [
        "PASSWORD",
        "MAGIC_LINK",
        "OAUTH_GOOGLE",
        "OAUTH_MICROSOFT",
        "OTP_EMAIL",
        "OTP_SMS",
      ].includes(value),
    );

  return allowed.length > 0 ? allowed : defaultAllowedAuthMethods;
}

export async function getAllowedAuthMethods(companyId: string): Promise<AuthMethod[]> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { allowedAuthMethods: true },
  });
  return parseAllowedAuthMethods(company?.allowedAuthMethods);
}

export async function assertAuthMethodAllowed(companyId: string, method: AuthMethod): Promise<void> {
  const allowed = await getAllowedAuthMethods(companyId);
  if (!allowed.includes(method)) {
    throw new IamError("AUTH_METHOD_DISABLED", `${method} is disabled for this tenant`);
  }
}

export async function assertAuthMethodAllowedForEmail(email: string, method: AuthMethod): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const memberships = await prisma.companyMembership.findMany({
    where: {
      status: "ACTIVE",
      user: { email: normalized },
    },
    select: {
      company: {
        select: {
          id: true,
          allowedAuthMethods: true,
        },
      },
    },
  });

  if (memberships.length === 0) return;

  const hasAllowed = memberships.some((row) =>
    parseAllowedAuthMethods(row.company.allowedAuthMethods).includes(method),
  );
  if (!hasAllowed) {
    throw new IamError("AUTH_METHOD_DISABLED", `${method} is disabled for this user memberships`);
  }
}

export function isMfaRequired(role: string, policy: MfaPolicy): boolean {
  if (policy.mode === "REQUIRED_FOR_ALL") return true;
  if (policy.mode === "REQUIRED_FOR_ADMINS") {
    return policy.enforceForRoles.includes(role);
  }
  return false;
}
