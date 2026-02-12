import type { PermissionKey } from "@/modules/iam/domain/permissions";

export type PlatformRole = "SUPER_ADMIN" | "SUPPORT" | "NONE";
export type MembershipStatus = "ACTIVE" | "INVITED" | "SUSPENDED";
export type TenantStatus = "ACTIVE" | "DISABLED" | "PENDING_DELETION";
export type AuthMethod =
  | "PASSWORD"
  | "MAGIC_LINK"
  | "OAUTH_GOOGLE"
  | "OAUTH_MICROSOFT"
  | "OTP_EMAIL"
  | "OTP_SMS";
export type MfaPolicyMode = "OPTIONAL" | "REQUIRED_FOR_ADMINS" | "REQUIRED_FOR_ALL";

export interface SessionPolicy {
  idleTimeoutMinutes: number;
  absoluteTimeoutMinutes: number;
  rememberMeAbsoluteTimeoutMinutes: number;
  rotateEveryMinutes: number;
}

export interface MfaPolicy {
  mode: MfaPolicyMode;
  enforceForRoles: string[];
  allowOtpFallback: boolean;
}

export interface BotProtectionPolicy {
  turnstileEnabled: boolean;
  turnstileSecretKey?: string;
  rateLimitWindowSeconds: number;
  rateLimitMaxAttempts: number;
}

export interface TenantContext {
  companyId: string;
  companySlug?: string | null;
  companyName?: string | null;
  host?: string | null;
}

export interface IamPrincipal {
  userId: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  activeCompanyId: string;
  membershipRole: string;
  permissions: PermissionKey[];
  sessionId: string;
  stepUpVerifiedAt?: Date | null;
  mfaRequired?: boolean;
}

export interface TenantTheme {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  cssVars?: Record<string, string> | null;
  customCss?: string | null;
}
