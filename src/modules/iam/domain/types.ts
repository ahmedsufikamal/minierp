import type { PermissionKey } from "@/modules/iam/domain/permissions";

export type PlatformRole = "SUPER_ADMIN" | "SUPPORT" | "NONE";
export type MembershipStatus = "ACTIVE" | "INVITED" | "SUSPENDED";
export type TenantStatus = "ACTIVE" | "DISABLED" | "PENDING_DELETION";
export type UserTypeLevel = 2 | 3 | 4 | 5 | 9;
export type UserTypeLabel =
  | "SUPPORT_USER"
  | "GENERAL_USER"
  | "ADMINISTRATOR_USER"
  | "MASTER_USER"
  | "SUPER_USER";
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
  userTypeLevel: UserTypeLevel;
  effectiveLevel: UserTypeLevel;
  activeMembershipStatus: MembershipStatus;
  permissions: PermissionKey[];
  sessionId: string;
  stepUpVerifiedAt?: Date | null;
  mfaRequired?: boolean;
  mustResetPassword?: boolean;
  isImpersonating?: boolean;
  impersonatorUserId?: string | null;
  impersonationExpiresAt?: Date | null;
  deviceFingerprint?: string | null;
}

export interface IamMfaFactorSummary {
  id: string;
  type: "TOTP" | "OTP_EMAIL" | "OTP_SMS";
  label: string | null;
  destination: string | null;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface IamAutoJoinRuleConfig {
  domains?: string[];
  allowlist?: string[];
  requireAdminApproval?: boolean;
}

export interface IamAutoJoinRuleSummary {
  id: string;
  ruleType: "VERIFIED_DOMAIN" | "EMAIL_ALLOWLIST" | "MANUAL_APPROVAL";
  config: IamAutoJoinRuleConfig;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantTheme {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  cssVars?: Record<string, string> | null;
  customCss?: string | null;
}
