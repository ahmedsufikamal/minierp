-- IAM closure phase: account verification + forced password reset + domain verification metadata

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pendingEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingEmailExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mustResetPassword" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "User_pendingEmail_idx" ON "User"("pendingEmail");

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "domainVerificationToken" TEXT,
  ADD COLUMN IF NOT EXISTS "domainVerificationGeneratedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Company_domainVerificationToken_idx" ON "Company"("domainVerificationToken");
