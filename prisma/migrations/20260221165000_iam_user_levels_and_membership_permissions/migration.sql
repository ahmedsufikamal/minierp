-- Add level-first IAM columns to company memberships.
ALTER TABLE "CompanyMembership"
  ADD COLUMN IF NOT EXISTS "userTypeLevel" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "userTypeLabel" TEXT;

-- Backfill role-based levels.
UPDATE "CompanyMembership"
SET "userTypeLevel" = CASE
  WHEN role = 'OWNER' THEN 5
  WHEN role = 'ADMIN' THEN 4
  WHEN role = 'SUPPORT' THEN 2
  ELSE 3
END;

-- Super user (platform-wide) remains highest precedence.
UPDATE "CompanyMembership" AS membership
SET "userTypeLevel" = 9
FROM "User" AS app_user
WHERE app_user.id = membership."userId"
  AND app_user."platformRole" = 'SUPER_ADMIN';

UPDATE "CompanyMembership"
SET "userTypeLabel" = CASE "userTypeLevel"
  WHEN 9 THEN 'SUPER_USER'
  WHEN 5 THEN 'MASTER_USER'
  WHEN 4 THEN 'ADMINISTRATOR_USER'
  WHEN 2 THEN 'SUPPORT_USER'
  ELSE 'GENERAL_USER'
END;

DO $$
BEGIN
  ALTER TABLE "CompanyMembership"
    ADD CONSTRAINT "CompanyMembership_userTypeLevel_check"
    CHECK ("userTypeLevel" IN (2, 3, 4, 5, 9));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CompanyMembership_companyId_userTypeLevel_status_idx"
  ON "CompanyMembership" ("companyId", "userTypeLevel", "status");
CREATE INDEX IF NOT EXISTS "CompanyMembership_userId_companyId_status_idx"
  ON "CompanyMembership" ("userId", "companyId", "status");

-- One active Master User (level 5) per company.
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_one_active_level5_per_company_idx"
  ON "CompanyMembership" ("companyId")
  WHERE "userTypeLevel" = 5 AND status = 'ACTIVE';

-- Membership-level permission overrides for level 3 users.
CREATE TABLE IF NOT EXISTS "CompanyMembershipPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyMembershipPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembershipPermission_userId_companyId_permissionId_key"
  ON "CompanyMembershipPermission" ("userId", "companyId", "permissionId");
CREATE INDEX IF NOT EXISTS "CompanyMembershipPermission_companyId_userId_idx"
  ON "CompanyMembershipPermission" ("companyId", "userId");
CREATE INDEX IF NOT EXISTS "CompanyMembershipPermission_companyId_permissionId_idx"
  ON "CompanyMembershipPermission" ("companyId", "permissionId");

DO $$
BEGIN
  ALTER TABLE "CompanyMembershipPermission"
    ADD CONSTRAINT "CompanyMembershipPermission_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "IamPermission"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CompanyMembershipPermission"
    ADD CONSTRAINT "CompanyMembershipPermission_userId_companyId_fkey"
    FOREIGN KEY ("userId", "companyId")
    REFERENCES "CompanyMembership"("userId", "companyId")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
