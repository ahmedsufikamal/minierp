-- CreateEnum
CREATE TYPE "PaymentEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AccountingExchangeRate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "orgId" TEXT NOT NULL,
  "fromCurrency" TEXT NOT NULL,
  "toCurrency" TEXT NOT NULL,
  "rate" DECIMAL(18,6) NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingCostCenter" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "orgId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingCostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingDimension" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "orgId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "orgId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "PaymentEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "type" "PaymentType" NOT NULL,
  "partyType" TEXT,
  "partyId" TEXT,
  "postingDate" DATE NOT NULL,
  "paidAmountCents" INTEGER NOT NULL,
  "receivedAmountCents" INTEGER NOT NULL,
  "sourceCurrency" TEXT NOT NULL DEFAULT 'USD',
  "targetCurrency" TEXT NOT NULL DEFAULT 'USD',
  "exchangeRate" DECIMAL(18,6),
  "paidFromAccountId" TEXT,
  "paidToAccountId" TEXT,
  "costCenterId" TEXT,
  "dimensions" JSONB,
  "remarks" TEXT,
  "submittedAt" TIMESTAMP(3),
  "submittedBy" TEXT,
  "postedAt" TIMESTAMP(3),
  "postedBy" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
  "id" TEXT NOT NULL,
  "paymentEntryId" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "allocatedAmountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "exchangeRate" DECIMAL(18,6),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AER_org_pair_eff_uk"
ON "AccountingExchangeRate"("orgId", "fromCurrency", "toCurrency", "effectiveDate");

CREATE INDEX "AER_org_pair_eff_idx"
ON "AccountingExchangeRate"("orgId", "fromCurrency", "toCurrency", "effectiveDate");

CREATE INDEX "AER_org_active_eff_idx"
ON "AccountingExchangeRate"("orgId", "isActive", "effectiveDate");

CREATE UNIQUE INDEX "AccountingCostCenter_orgId_code_key"
ON "AccountingCostCenter"("orgId", "code");

CREATE INDEX "AccountingCostCenter_orgId_parentId_idx"
ON "AccountingCostCenter"("orgId", "parentId");

CREATE INDEX "AccountingCostCenter_orgId_isActive_name_idx"
ON "AccountingCostCenter"("orgId", "isActive", "name");

CREATE UNIQUE INDEX "AccountingDimension_orgId_key_key"
ON "AccountingDimension"("orgId", "key");

CREATE INDEX "AccountingDimension_orgId_isActive_key_idx"
ON "AccountingDimension"("orgId", "isActive", "key");

CREATE UNIQUE INDEX "PaymentEntry_orgId_number_key"
ON "PaymentEntry"("orgId", "number");

CREATE INDEX "PaymentEntry_orgId_status_postingDate_idx"
ON "PaymentEntry"("orgId", "status", "postingDate");

CREATE INDEX "PaymentEntry_orgId_partyType_partyId_idx"
ON "PaymentEntry"("orgId", "partyType", "partyId");

CREATE INDEX "PaymentEntry_orgId_costCenterId_idx"
ON "PaymentEntry"("orgId", "costCenterId");

CREATE INDEX "PaymentAllocation_paymentEntryId_referenceType_referenceId_idx"
ON "PaymentAllocation"("paymentEntryId", "referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "AccountingCostCenter"
ADD CONSTRAINT "AccountingCostCenter_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "AccountingCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEntry"
ADD CONSTRAINT "PaymentEntry_paidFromAccountId_fkey"
FOREIGN KEY ("paidFromAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEntry"
ADD CONSTRAINT "PaymentEntry_paidToAccountId_fkey"
FOREIGN KEY ("paidToAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEntry"
ADD CONSTRAINT "PaymentEntry_costCenterId_fkey"
FOREIGN KEY ("costCenterId") REFERENCES "AccountingCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAllocation"
ADD CONSTRAINT "PaymentAllocation_paymentEntryId_fkey"
FOREIGN KEY ("paymentEntryId") REFERENCES "PaymentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
