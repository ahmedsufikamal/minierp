-- Phase 2 Wave 1: accounting MVP baseline (fiscal year, periods, GL entries, account hierarchy, posting metadata).

DO $$ BEGIN
  CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Account"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "parentId" TEXT,
  ADD COLUMN IF NOT EXISTS "isGroup" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "rootType" "AccountType";

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Account_parentId_fkey'
      AND conrelid = '"Account"'::regclass
  ) THEN
    ALTER TABLE "Account"
      ADD CONSTRAINT "Account_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Account_orgId_parentId_idx" ON "Account"("orgId", "parentId");
CREATE INDEX IF NOT EXISTS "Account_orgId_rootType_idx" ON "Account"("orgId", "rootType");

ALTER TABLE "JournalEntry"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "number" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "postingDate" DATE,
  ADD COLUMN IF NOT EXISTS "fiscalYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "accountingPeriodId" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "postedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT,
  ADD COLUMN IF NOT EXISTS "totalDebitCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalCreditCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_orgId_number_key" ON "JournalEntry"("orgId", "number");
CREATE INDEX IF NOT EXISTS "JournalEntry_orgId_date_idx" ON "JournalEntry"("orgId", "date");
CREATE INDEX IF NOT EXISTS "JournalEntry_tenantId_orgId_status_date_idx" ON "JournalEntry"("tenantId", "orgId", "status", "date");

ALTER TABLE "JournalLine"
  ADD COLUMN IF NOT EXISTS "lineNo" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE INDEX IF NOT EXISTS "JournalLine_entryId_lineNo_idx" ON "JournalLine"("entryId", "lineNo");

CREATE TABLE IF NOT EXISTS "FiscalYear" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT FALSE,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdBy" TEXT,
  "closedBy" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalYear_tenantId_orgId_name_key" ON "FiscalYear"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "FiscalYear_tenantId_orgId_startDate_endDate_idx" ON "FiscalYear"("tenantId", "orgId", "startDate", "endDate");

CREATE TABLE IF NOT EXISTS "AccountingPeriod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "isYearEnd" BOOLEAN NOT NULL DEFAULT FALSE,
  "closedBy" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountingPeriod_tenantId_orgId_fiscalYearId_name_key"
  ON "AccountingPeriod"("tenantId", "orgId", "fiscalYearId", "name");
CREATE INDEX IF NOT EXISTS "AccountingPeriod_tenantId_orgId_status_startDate_endDate_idx"
  ON "AccountingPeriod"("tenantId", "orgId", "status", "startDate", "endDate");

CREATE TABLE IF NOT EXISTS "GLEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "postingDate" DATE NOT NULL,
  "accountId" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "fiscalYearId" TEXT,
  "accountingPeriodId" TEXT,
  "debitCents" INTEGER NOT NULL DEFAULT 0,
  "creditCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "voucherType" TEXT,
  "voucherId" TEXT,
  "remarks" TEXT,
  "metadata" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GLEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GLEntry_tenantId_orgId_postingDate_idx" ON "GLEntry"("tenantId", "orgId", "postingDate");
CREATE INDEX IF NOT EXISTS "GLEntry_tenantId_orgId_accountId_postingDate_idx" ON "GLEntry"("tenantId", "orgId", "accountId", "postingDate");
CREATE INDEX IF NOT EXISTS "GLEntry_tenantId_orgId_voucherType_voucherId_idx" ON "GLEntry"("tenantId", "orgId", "voucherType", "voucherId");
CREATE INDEX IF NOT EXISTS "GLEntry_journalEntryId_idx" ON "GLEntry"("journalEntryId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FiscalYear_tenantId_fkey'
      AND conrelid = '"FiscalYear"'::regclass
  ) THEN
    ALTER TABLE "FiscalYear"
      ADD CONSTRAINT "FiscalYear_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FiscalYear_orgId_fkey'
      AND conrelid = '"FiscalYear"'::regclass
  ) THEN
    ALTER TABLE "FiscalYear"
      ADD CONSTRAINT "FiscalYear_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccountingPeriod_tenantId_fkey'
      AND conrelid = '"AccountingPeriod"'::regclass
  ) THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccountingPeriod_orgId_fkey'
      AND conrelid = '"AccountingPeriod"'::regclass
  ) THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AccountingPeriod_fiscalYearId_fkey'
      AND conrelid = '"AccountingPeriod"'::regclass
  ) THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_fiscalYearId_fkey"
      FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GLEntry_tenantId_fkey'
      AND conrelid = '"GLEntry"'::regclass
  ) THEN
    ALTER TABLE "GLEntry"
      ADD CONSTRAINT "GLEntry_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GLEntry_orgId_fkey'
      AND conrelid = '"GLEntry"'::regclass
  ) THEN
    ALTER TABLE "GLEntry"
      ADD CONSTRAINT "GLEntry_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GLEntry_accountId_fkey'
      AND conrelid = '"GLEntry"'::regclass
  ) THEN
    ALTER TABLE "GLEntry"
      ADD CONSTRAINT "GLEntry_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GLEntry_journalEntryId_fkey'
      AND conrelid = '"GLEntry"'::regclass
  ) THEN
    ALTER TABLE "GLEntry"
      ADD CONSTRAINT "GLEntry_journalEntryId_fkey"
      FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GLEntry_fiscalYearId_fkey'
      AND conrelid = '"GLEntry"'::regclass
  ) THEN
    ALTER TABLE "GLEntry"
      ADD CONSTRAINT "GLEntry_fiscalYearId_fkey"
      FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GLEntry_accountingPeriodId_fkey'
      AND conrelid = '"GLEntry"'::regclass
  ) THEN
    ALTER TABLE "GLEntry"
      ADD CONSTRAINT "GLEntry_accountingPeriodId_fkey"
      FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'JournalEntry_fiscalYearId_fkey'
      AND conrelid = '"JournalEntry"'::regclass
  ) THEN
    ALTER TABLE "JournalEntry"
      ADD CONSTRAINT "JournalEntry_fiscalYearId_fkey"
      FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'JournalEntry_accountingPeriodId_fkey'
      AND conrelid = '"JournalEntry"'::regclass
  ) THEN
    ALTER TABLE "JournalEntry"
      ADD CONSTRAINT "JournalEntry_accountingPeriodId_fkey"
      FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill account tenantId from company. This keeps legacy records queryable with tenant context.
UPDATE "Account" a
SET "tenantId" = c."tenantId"
FROM "Company" c
WHERE a."orgId" = c."id"
  AND a."tenantId" IS NULL
  AND c."tenantId" IS NOT NULL;
