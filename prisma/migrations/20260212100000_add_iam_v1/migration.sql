-- IAM v1 baseline

DO $$ BEGIN
  CREATE TYPE "IamTenantStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING_DELETION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamPlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamUserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamMembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamAuthMethod" AS ENUM ('PASSWORD', 'MAGIC_LINK', 'OAUTH_GOOGLE', 'OAUTH_MICROSOFT', 'OTP_EMAIL', 'OTP_SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamMfaPolicyMode" AS ENUM ('OPTIONAL', 'REQUIRED_FOR_ADMINS', 'REQUIRED_FOR_ALL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamDomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamOtpChannel" AS ENUM ('EMAIL', 'SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamSessionRevokeReason" AS ENUM ('USER_LOGOUT', 'USER_REVOKE_ALL', 'ADMIN_REVOKE', 'SECURITY_EVENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamMfaFactorType" AS ENUM ('TOTP', 'OTP_EMAIL', 'OTP_SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamAutoJoinRuleType" AS ENUM ('VERIFIED_DOMAIN', 'EMAIL_ALLOWLIST', 'MANUAL_APPROVAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IamAuditAction" AS ENUM (
    'AUTH_LOGIN', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_SIGNUP',
    'MFA_ENROLLED', 'MFA_CHALLENGE_VERIFIED', 'OTP_SENT', 'OTP_VERIFIED',
    'MAGIC_LINK_SENT', 'MAGIC_LINK_VERIFIED', 'SESSION_REVOKED', 'SESSION_REVOKE_ALL',
    'INVITE_SENT', 'INVITE_ACCEPTED', 'ROLE_CHANGED', 'POLICY_UPDATED',
    'IMPERSONATION_STARTED', 'IMPERSONATION_ENDED', 'TENANT_DISABLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "platformRole" "IamPlatformRole" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "status" "IamUserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "activeOrgId" TEXT,
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "status" "IamTenantStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "primaryColor" TEXT,
  ADD COLUMN IF NOT EXISTS "accentColor" TEXT,
  ADD COLUMN IF NOT EXISTS "fontFamily" TEXT,
  ADD COLUMN IF NOT EXISTS "cssVars" JSONB,
  ADD COLUMN IF NOT EXISTS "customCss" TEXT,
  ADD COLUMN IF NOT EXISTS "primaryDomain" TEXT,
  ADD COLUMN IF NOT EXISTS "allowedDomains" JSONB,
  ADD COLUMN IF NOT EXISTS "domainVerificationStatus" "IamDomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "allowedAuthMethods" JSONB,
  ADD COLUMN IF NOT EXISTS "mfaPolicy" JSONB,
  ADD COLUMN IF NOT EXISTS "sessionPolicy" JSONB,
  ADD COLUMN IF NOT EXISTS "botProtectionPolicy" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_primaryDomain_key" ON "Company"("primaryDomain");

ALTER TABLE "CompanyMembership"
  ADD COLUMN IF NOT EXISTS "roleId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "IamMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CompanyMembership_companyId_roleId_idx" ON "CompanyMembership"("companyId", "roleId");

CREATE TABLE IF NOT EXISTS "IamPermission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IamPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamPermission_key_key" ON "IamPermission"("key");
CREATE INDEX IF NOT EXISTS "IamPermission_module_idx" ON "IamPermission"("module");

CREATE TABLE IF NOT EXISTS "IamRole" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IamRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamRole_orgId_name_key" ON "IamRole"("orgId", "name");
CREATE INDEX IF NOT EXISTS "IamRole_orgId_isSystem_idx" ON "IamRole"("orgId", "isSystem");

CREATE TABLE IF NOT EXISTS "IamRolePermission" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IamRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamRolePermission_roleId_permissionId_key" ON "IamRolePermission"("roleId", "permissionId");
CREATE INDEX IF NOT EXISTS "IamRolePermission_permissionId_idx" ON "IamRolePermission"("permissionId");

CREATE TABLE IF NOT EXISTS "IamAutoJoinRule" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "ruleType" "IamAutoJoinRuleType" NOT NULL,
  "config" JSONB NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IamAutoJoinRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IamAutoJoinRule_orgId_ruleType_isEnabled_idx" ON "IamAutoJoinRule"("orgId", "ruleType", "isEnabled");

CREATE TABLE IF NOT EXISTS "IamInvitation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "autoJoinRuleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamInvitation_tokenHash_key" ON "IamInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "IamInvitation_orgId_email_idx" ON "IamInvitation"("orgId", "email");
CREATE INDEX IF NOT EXISTS "IamInvitation_orgId_createdAt_idx" ON "IamInvitation"("orgId", "createdAt");

CREATE TABLE IF NOT EXISTS "IamSession" (
  "id" TEXT NOT NULL,
  "sessionTokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "impersonatorUserId" TEXT,
  "rememberMe" BOOLEAN NOT NULL DEFAULT FALSE,
  "userAgent" TEXT,
  "ip" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idleExpiresAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "stepUpVerifiedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokeReason" "IamSessionRevokeReason",
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IamSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamSession_sessionTokenHash_key" ON "IamSession"("sessionTokenHash");
CREATE INDEX IF NOT EXISTS "IamSession_userId_createdAt_idx" ON "IamSession"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "IamSession_orgId_createdAt_idx" ON "IamSession"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "IamSession_expiresAt_idx" ON "IamSession"("expiresAt");

CREATE TABLE IF NOT EXISTS "IamMfaFactor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "IamMfaFactorType" NOT NULL,
  "label" TEXT,
  "secretEnc" TEXT,
  "destination" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "verifiedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IamMfaFactor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IamMfaFactor_userId_type_idx" ON "IamMfaFactor"("userId", "type");

CREATE TABLE IF NOT EXISTS "IamRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "factorId" TEXT,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IamRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamRecoveryCode_codeHash_key" ON "IamRecoveryCode"("codeHash");

CREATE TABLE IF NOT EXISTS "IamOtpChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "orgId" TEXT,
  "channel" "IamOtpChannel" NOT NULL,
  "destination" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "requestId" TEXT,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IamOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IamOtpChallenge_destination_createdAt_idx" ON "IamOtpChallenge"("destination", "createdAt");
CREATE INDEX IF NOT EXISTS "IamOtpChallenge_orgId_createdAt_idx" ON "IamOtpChallenge"("orgId", "createdAt");

CREATE TABLE IF NOT EXISTS "IamMagicLinkToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "requestId" TEXT,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IamMagicLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamMagicLinkToken_tokenHash_key" ON "IamMagicLinkToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "IamMagicLinkToken_email_createdAt_idx" ON "IamMagicLinkToken"("email", "createdAt");

CREATE TABLE IF NOT EXISTS "IamOAuthAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IamOAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamOAuthAccount_provider_providerUserId_key" ON "IamOAuthAccount"("provider", "providerUserId");
CREATE INDEX IF NOT EXISTS "IamOAuthAccount_userId_provider_idx" ON "IamOAuthAccount"("userId", "provider");

CREATE TABLE IF NOT EXISTS "IamAuditLog" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "actorUserId" TEXT,
  "action" "IamAuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IamAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IamAuditLog_orgId_createdAt_idx" ON "IamAuditLog"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "IamAuditLog_action_createdAt_idx" ON "IamAuditLog"("action", "createdAt");

CREATE TABLE IF NOT EXISTS "IamLoginAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "orgId" TEXT,
  "email" TEXT,
  "result" TEXT NOT NULL,
  "reasonCode" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IamLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IamLoginAttempt_email_createdAt_idx" ON "IamLoginAttempt"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "IamLoginAttempt_orgId_createdAt_idx" ON "IamLoginAttempt"("orgId", "createdAt");

CREATE TABLE IF NOT EXISTS "IamImpersonationSession" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "targetCompanyId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "IamImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IamImpersonationSession_sessionId_key" ON "IamImpersonationSession"("sessionId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_activeOrgId_fkey"
  FOREIGN KEY ("activeOrgId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyMembership"
  ADD CONSTRAINT "CompanyMembership_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "IamRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamRole"
  ADD CONSTRAINT "IamRole_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamRolePermission"
  ADD CONSTRAINT "IamRolePermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "IamRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamRolePermission"
  ADD CONSTRAINT "IamRolePermission_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "IamPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamAutoJoinRule"
  ADD CONSTRAINT "IamAutoJoinRule_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamInvitation"
  ADD CONSTRAINT "IamInvitation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamInvitation"
  ADD CONSTRAINT "IamInvitation_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "IamRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamInvitation"
  ADD CONSTRAINT "IamInvitation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamInvitation"
  ADD CONSTRAINT "IamInvitation_autoJoinRuleId_fkey"
  FOREIGN KEY ("autoJoinRuleId") REFERENCES "IamAutoJoinRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamSession"
  ADD CONSTRAINT "IamSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamSession"
  ADD CONSTRAINT "IamSession_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamMfaFactor"
  ADD CONSTRAINT "IamMfaFactor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamRecoveryCode"
  ADD CONSTRAINT "IamRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamRecoveryCode"
  ADD CONSTRAINT "IamRecoveryCode_factorId_fkey"
  FOREIGN KEY ("factorId") REFERENCES "IamMfaFactor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamOtpChallenge"
  ADD CONSTRAINT "IamOtpChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamOtpChallenge"
  ADD CONSTRAINT "IamOtpChallenge_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamMagicLinkToken"
  ADD CONSTRAINT "IamMagicLinkToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamOAuthAccount"
  ADD CONSTRAINT "IamOAuthAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamAuditLog"
  ADD CONSTRAINT "IamAuditLog_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamAuditLog"
  ADD CONSTRAINT "IamAuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamLoginAttempt"
  ADD CONSTRAINT "IamLoginAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamLoginAttempt"
  ADD CONSTRAINT "IamLoginAttempt_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IamImpersonationSession"
  ADD CONSTRAINT "IamImpersonationSession_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "IamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamImpersonationSession"
  ADD CONSTRAINT "IamImpersonationSession_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamImpersonationSession"
  ADD CONSTRAINT "IamImpersonationSession_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IamImpersonationSession"
  ADD CONSTRAINT "IamImpersonationSession_targetCompanyId_fkey"
  FOREIGN KEY ("targetCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
