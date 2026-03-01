CREATE TYPE "TradeLcType" AS ENUM ('IMPORT', 'EXPORT');
CREATE TYPE "TradeLcStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'ISSUED', 'ACTIVE', 'DOCS_RECEIVED', 'UNDER_SCRUTINY', 'DISCREPANT', 'ACCEPTED', 'SETTLED', 'CLOSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "TradeLcAmendmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CONFIRMED');
CREATE TYPE "TradeLcDocumentSetStatus" AS ENUM ('PENDING', 'RECEIVED', 'VERIFIED', 'DISCREPANT', 'ACCEPTED', 'REJECTED');
CREATE TYPE "TradeLcDiscrepancySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "TradeLcDiscrepancyDecision" AS ENUM ('PENDING', 'WAIVED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "TradeLcAllocationTarget" AS ENUM ('LANDED_COST', 'EXPENSE');
CREATE TYPE "TradeLcPaymentType" AS ENUM ('MARGIN', 'SETTLEMENT', 'CHARGE', 'OTHER');
CREATE TYPE "TradeLcPaymentMethod" AS ENUM ('BANK_TRANSFER', 'TT', 'CASH', 'OTHER');
CREATE TYPE "TradeLcPaymentStatus" AS ENUM ('PLANNED', 'INITIATED', 'PAID', 'REVERSED');
CREATE TYPE "TradeLcEventType" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'ISSUED', 'DOCS_RECEIVED', 'DOCSET_VERIFIED', 'DISCREPANCY_ADDED', 'DISCREPANCY_WAIVED', 'DISCREPANCY_REJECTED', 'ACCEPTED', 'PAYMENT_POSTED', 'SETTLED', 'CLOSED', 'CANCELLED', 'EXPIRED', 'AMENDED', 'ATTACHMENT_UPLOADED');

CREATE TABLE "TradeLc" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcNo" TEXT,
  "lcType" "TradeLcType" NOT NULL DEFAULT 'IMPORT',
  "status" "TradeLcStatus" NOT NULL DEFAULT 'DRAFT',
  "beneficiaryVendorId" TEXT NOT NULL,
  "issuingBankId" TEXT NOT NULL,
  "advisingBankId" TEXT,
  "confirmingBankId" TEXT,
  "currency" TEXT NOT NULL,
  "lcAmount" DECIMAL(18,2) NOT NULL,
  "tolerancePercent" DECIMAL(9,4),
  "issueDate" TIMESTAMP(3),
  "maturityDate" TIMESTAMP(3),
  "latestShipmentDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "placeOfExpiry" TEXT,
  "shipmentFrom" TEXT,
  "shipmentTo" TEXT,
  "portOfLoading" TEXT,
  "portOfDischarge" TEXT,
  "partialShipmentAllowed" BOOLEAN NOT NULL DEFAULT false,
  "transshipmentAllowed" BOOLEAN NOT NULL DEFAULT false,
  "marginPercent" DECIMAL(9,4),
  "marginAmount" DECIMAL(18,2),
  "lienReference" TEXT,
  "incotermCode" TEXT,
  "remarks" TEXT,
  "termsText" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcPoLink" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "coveredAmount" DECIMAL(18,2) NOT NULL,
  "coveredCurrency" TEXT NOT NULL,
  "externalReference" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcPoLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcAmendment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT NOT NULL,
  "amendmentNo" TEXT NOT NULL,
  "amendmentDate" TIMESTAMP(3) NOT NULL,
  "changesJson" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "TradeLcAmendmentStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "publishedBy" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcAmendment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcDocumentSet" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT NOT NULL,
  "shipmentRef" TEXT,
  "shipmentDate" TIMESTAMP(3),
  "etaDate" TIMESTAMP(3),
  "docsReceivedDate" TIMESTAMP(3),
  "status" "TradeLcDocumentSetStatus" NOT NULL DEFAULT 'PENDING',
  "verificationNotes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcDocumentSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcDocumentLine" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "documentSetId" TEXT NOT NULL,
  "documentTypeCode" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "received" BOOLEAN NOT NULL DEFAULT false,
  "referenceNo" TEXT,
  "issueDate" TIMESTAMP(3),
  "notes" TEXT,
  "attachmentId" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcDocumentLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcDiscrepancy" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT NOT NULL,
  "documentSetId" TEXT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "TradeLcDiscrepancySeverity" NOT NULL DEFAULT 'MEDIUM',
  "decision" "TradeLcDiscrepancyDecision" NOT NULL DEFAULT 'PENDING',
  "decisionNotes" TEXT,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcDiscrepancy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcCharge" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT NOT NULL,
  "chargeTypeCode" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "chargedBy" TEXT NOT NULL,
  "chargeDate" TIMESTAMP(3) NOT NULL,
  "allocatable" BOOLEAN NOT NULL DEFAULT false,
  "allocationTarget" "TradeLcAllocationTarget",
  "allocationNotes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcPayment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT NOT NULL,
  "paymentType" "TradeLcPaymentType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "valueDate" TIMESTAMP(3),
  "method" "TradeLcPaymentMethod" NOT NULL,
  "bankAccountId" TEXT,
  "status" "TradeLcPaymentStatus" NOT NULL DEFAULT 'PLANNED',
  "externalRef" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT NOT NULL,
  "eventType" "TradeLcEventType" NOT NULL,
  "message" TEXT NOT NULL,
  "dataJson" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcAttachment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "lcId" TEXT,
  "documentLineId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "uploadedBy" TEXT,
  "uploadedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcSetting" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "dualControlEnabled" BOOLEAN NOT NULL DEFAULT true,
  "expiringSoonDays" INTEGER NOT NULL DEFAULT 30,
  "maturitySoonDays" INTEGER NOT NULL DEFAULT 15,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcBank" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "swift" TEXT,
  "address" TEXT,
  "country" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcBank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcDocumentType" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "defaultRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcDocumentType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcChargeType" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "defaultAllocatable" BOOLEAN NOT NULL DEFAULT false,
  "defaultAllocationTarget" "TradeLcAllocationTarget",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcChargeType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeLcIncoterm" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TradeLcIncoterm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradeLc_tenantId_companyId_lcNo_key" ON "TradeLc"("tenantId", "companyId", "lcNo");
CREATE INDEX "TradeLc_tenantId_companyId_status_expiryDate_idx" ON "TradeLc"("tenantId", "companyId", "status", "expiryDate");
CREATE INDEX "TradeLc_tenantId_companyId_beneficiaryVendorId_idx" ON "TradeLc"("tenantId", "companyId", "beneficiaryVendorId");
CREATE INDEX "TradeLc_tenantId_companyId_issuingBankId_idx" ON "TradeLc"("tenantId", "companyId", "issuingBankId");

CREATE UNIQUE INDEX "TradeLcPoLink_tenantId_companyId_lcId_purchaseOrderId_key" ON "TradeLcPoLink"("tenantId", "companyId", "lcId", "purchaseOrderId");
CREATE INDEX "TradeLcPoLink_tenantId_companyId_lcId_idx" ON "TradeLcPoLink"("tenantId", "companyId", "lcId");

CREATE UNIQUE INDEX "TradeLcAmendment_tenantId_companyId_lcId_amendmentNo_key" ON "TradeLcAmendment"("tenantId", "companyId", "lcId", "amendmentNo");
CREATE INDEX "TradeLcAmendment_tenantId_companyId_lcId_status_idx" ON "TradeLcAmendment"("tenantId", "companyId", "lcId", "status");

CREATE INDEX "TradeLcDocumentSet_tenantId_companyId_lcId_status_idx" ON "TradeLcDocumentSet"("tenantId", "companyId", "lcId", "status");
CREATE UNIQUE INDEX "TradeLcDocumentLine_tenantId_companyId_documentSetId_documentTypeCode_key" ON "TradeLcDocumentLine"("tenantId", "companyId", "documentSetId", "documentTypeCode");
CREATE INDEX "TradeLcDocumentLine_tenantId_companyId_documentSetId_required_received_idx" ON "TradeLcDocumentLine"("tenantId", "companyId", "documentSetId", "required", "received");

CREATE INDEX "TradeLcDiscrepancy_tenantId_companyId_lcId_decision_idx" ON "TradeLcDiscrepancy"("tenantId", "companyId", "lcId", "decision");
CREATE INDEX "TradeLcDiscrepancy_tenantId_companyId_severity_decision_idx" ON "TradeLcDiscrepancy"("tenantId", "companyId", "severity", "decision");

CREATE INDEX "TradeLcCharge_tenantId_companyId_lcId_chargeDate_idx" ON "TradeLcCharge"("tenantId", "companyId", "lcId", "chargeDate");
CREATE INDEX "TradeLcPayment_tenantId_companyId_lcId_status_paymentDate_idx" ON "TradeLcPayment"("tenantId", "companyId", "lcId", "status", "paymentDate");
CREATE INDEX "TradeLcEvent_tenantId_companyId_lcId_createdAt_idx" ON "TradeLcEvent"("tenantId", "companyId", "lcId", "createdAt");
CREATE INDEX "TradeLcAttachment_tenantId_companyId_lcId_createdAt_idx" ON "TradeLcAttachment"("tenantId", "companyId", "lcId", "createdAt");
CREATE INDEX "TradeLcAttachment_tenantId_companyId_documentLineId_idx" ON "TradeLcAttachment"("tenantId", "companyId", "documentLineId");

CREATE UNIQUE INDEX "TradeLcSetting_tenantId_companyId_key" ON "TradeLcSetting"("tenantId", "companyId");
CREATE UNIQUE INDEX "TradeLcBank_tenantId_companyId_code_key" ON "TradeLcBank"("tenantId", "companyId", "code");
CREATE INDEX "TradeLcBank_tenantId_companyId_isActive_idx" ON "TradeLcBank"("tenantId", "companyId", "isActive");
CREATE UNIQUE INDEX "TradeLcDocumentType_tenantId_companyId_code_key" ON "TradeLcDocumentType"("tenantId", "companyId", "code");
CREATE INDEX "TradeLcDocumentType_tenantId_companyId_isActive_sortOrder_idx" ON "TradeLcDocumentType"("tenantId", "companyId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "TradeLcChargeType_tenantId_companyId_code_key" ON "TradeLcChargeType"("tenantId", "companyId", "code");
CREATE INDEX "TradeLcChargeType_tenantId_companyId_isActive_idx" ON "TradeLcChargeType"("tenantId", "companyId", "isActive");
CREATE UNIQUE INDEX "TradeLcIncoterm_tenantId_companyId_code_key" ON "TradeLcIncoterm"("tenantId", "companyId", "code");
CREATE INDEX "TradeLcIncoterm_tenantId_companyId_isActive_idx" ON "TradeLcIncoterm"("tenantId", "companyId", "isActive");

ALTER TABLE "TradeLc"
  ADD CONSTRAINT "TradeLc_beneficiaryVendorId_fkey" FOREIGN KEY ("beneficiaryVendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TradeLc_issuingBankId_fkey" FOREIGN KEY ("issuingBankId") REFERENCES "TradeLcBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TradeLc_advisingBankId_fkey" FOREIGN KEY ("advisingBankId") REFERENCES "TradeLcBank"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TradeLc_confirmingBankId_fkey" FOREIGN KEY ("confirmingBankId") REFERENCES "TradeLcBank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TradeLcPoLink"
  ADD CONSTRAINT "TradeLcPoLink_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TradeLcPoLink_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TradeLcAmendment"
  ADD CONSTRAINT "TradeLcAmendment_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeLcDocumentSet"
  ADD CONSTRAINT "TradeLcDocumentSet_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeLcDocumentLine"
  ADD CONSTRAINT "TradeLcDocumentLine_documentSetId_fkey" FOREIGN KEY ("documentSetId") REFERENCES "TradeLcDocumentSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeLcDiscrepancy"
  ADD CONSTRAINT "TradeLcDiscrepancy_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TradeLcDiscrepancy_documentSetId_fkey" FOREIGN KEY ("documentSetId") REFERENCES "TradeLcDocumentSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TradeLcCharge"
  ADD CONSTRAINT "TradeLcCharge_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeLcPayment"
  ADD CONSTRAINT "TradeLcPayment_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeLcEvent"
  ADD CONSTRAINT "TradeLcEvent_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TradeLcAttachment"
  ADD CONSTRAINT "TradeLcAttachment_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "TradeLc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
