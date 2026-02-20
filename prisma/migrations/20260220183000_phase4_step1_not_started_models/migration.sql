-- CreateEnum
CREATE TYPE "DunningNoticeStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FormLayoutVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PropertyOverrideTarget" AS ENUM ('FIELD', 'FORM', 'LIST', 'ACTION');

-- CreateEnum
CREATE TYPE "AutomationRuleRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierPaymentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QualityGoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ACHIEVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectBillingStatus" AS ENUM ('DRAFT', 'READY', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DunningNotice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesInvoiceId" TEXT,
    "status" "DunningNoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedOn" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE,
    "reminderLevel" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DunningNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivableAgingSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesInvoiceId" TEXT,
    "asOfDate" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bucketCurrentCents" INTEGER NOT NULL DEFAULT 0,
    "bucket1To30Cents" INTEGER NOT NULL DEFAULT 0,
    "bucket31To60Cents" INTEGER NOT NULL DEFAULT 0,
    "bucket61To90Cents" INTEGER NOT NULL DEFAULT 0,
    "bucketOver90Cents" INTEGER NOT NULL DEFAULT 0,
    "totalOutstandingCents" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivableAgingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "SupplierPaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidFromAccountId" TEXT,
    "paidToAccountId" TEXT,
    "paymentEntryId" TEXT,
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPaymentAllocation" (
    "id" TEXT NOT NULL,
    "supplierPaymentId" TEXT NOT NULL,
    "purchaseBillId" TEXT,
    "allocatedAmountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayableAgingSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseBillId" TEXT,
    "supplierPaymentId" TEXT,
    "asOfDate" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bucketCurrentCents" INTEGER NOT NULL DEFAULT 0,
    "bucket1To30Cents" INTEGER NOT NULL DEFAULT 0,
    "bucket31To60Cents" INTEGER NOT NULL DEFAULT 0,
    "bucket61To90Cents" INTEGER NOT NULL DEFAULT 0,
    "bucketOver90Cents" INTEGER NOT NULL DEFAULT 0,
    "totalOutstandingCents" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayableAgingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityGoal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metric" TEXT NOT NULL,
    "targetValue" DECIMAL(18,6) NOT NULL,
    "currentValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "status" "QualityGoalStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE,
    "dueDate" DATE,
    "ownerRef" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "feedbackBy" TEXT,
    "feedbackOn" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" INTEGER,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBillingEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ProjectBillingStatus" NOT NULL DEFAULT 'DRAFT',
    "projectId" TEXT NOT NULL,
    "timesheetId" TEXT,
    "salesInvoiceId" TEXT,
    "billableMinutes" INTEGER NOT NULL DEFAULT 0,
    "billAmountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "readyAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBillingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "orgId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "KnowledgeArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticleRevision" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "changelog" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeArticleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormLayoutVersion" (
    "id" TEXT NOT NULL,
    "formLayoutId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "FormLayoutVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "layout" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormLayoutVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyOverrideRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "entityType" TEXT NOT NULL,
    "target" "PropertyOverrideTarget" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "config" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyOverrideRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRuleRun" (
    "id" TEXT NOT NULL,
    "automationRuleId" TEXT,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "trigger" "AutomationTrigger" NOT NULL,
    "status" "AutomationRuleRunStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRuleRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DunningNotice_orgId_status_issuedOn_idx" ON "DunningNotice"("orgId", "status", "issuedOn");

-- CreateIndex
CREATE INDEX "DunningNotice_orgId_customerId_status_idx" ON "DunningNotice"("orgId", "customerId", "status");

-- CreateIndex
CREATE INDEX "DunningNotice_orgId_salesInvoiceId_idx" ON "DunningNotice"("orgId", "salesInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DunningNotice_orgId_number_key" ON "DunningNotice"("orgId", "number");

-- CreateIndex
CREATE INDEX "ReceivableAgingSnapshot_orgId_asOfDate_customerId_idx" ON "ReceivableAgingSnapshot"("orgId", "asOfDate", "customerId");

-- CreateIndex
CREATE INDEX "ReceivableAgingSnapshot_orgId_salesInvoiceId_asOfDate_idx" ON "ReceivableAgingSnapshot"("orgId", "salesInvoiceId", "asOfDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_orgId_status_paymentDate_idx" ON "SupplierPayment"("orgId", "status", "paymentDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_orgId_vendorId_status_idx" ON "SupplierPayment"("orgId", "vendorId", "status");

-- CreateIndex
CREATE INDEX "SupplierPayment_orgId_paymentEntryId_idx" ON "SupplierPayment"("orgId", "paymentEntryId");

-- CreateIndex
CREATE INDEX "SupplierPayment_orgId_paidFromAccountId_paidToAccountId_idx" ON "SupplierPayment"("orgId", "paidFromAccountId", "paidToAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_orgId_number_key" ON "SupplierPayment"("orgId", "number");

-- CreateIndex
CREATE INDEX "SupplierPaymentAllocation_supplierPaymentId_purchaseBillId_idx" ON "SupplierPaymentAllocation"("supplierPaymentId", "purchaseBillId");

-- CreateIndex
CREATE INDEX "PayableAgingSnapshot_orgId_asOfDate_vendorId_idx" ON "PayableAgingSnapshot"("orgId", "asOfDate", "vendorId");

-- CreateIndex
CREATE INDEX "PayableAgingSnapshot_orgId_purchaseBillId_asOfDate_idx" ON "PayableAgingSnapshot"("orgId", "purchaseBillId", "asOfDate");

-- CreateIndex
CREATE INDEX "QualityGoal_orgId_status_dueDate_idx" ON "QualityGoal"("orgId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "QualityGoal_orgId_key_key" ON "QualityGoal"("orgId", "key");

-- CreateIndex
CREATE INDEX "QualityFeedback_orgId_goalId_feedbackOn_idx" ON "QualityFeedback"("orgId", "goalId", "feedbackOn");

-- CreateIndex
CREATE INDEX "ProjectBillingEntry_orgId_status_projectId_idx" ON "ProjectBillingEntry"("orgId", "status", "projectId");

-- CreateIndex
CREATE INDEX "ProjectBillingEntry_orgId_timesheetId_idx" ON "ProjectBillingEntry"("orgId", "timesheetId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBillingEntry_orgId_number_key" ON "ProjectBillingEntry"("orgId", "number");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_orgId_status_updatedAt_idx" ON "KnowledgeArticle"("orgId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_orgId_slug_key" ON "KnowledgeArticle"("orgId", "slug");

-- CreateIndex
CREATE INDEX "KnowledgeArticleRevision_articleId_createdAt_idx" ON "KnowledgeArticleRevision"("articleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticleRevision_articleId_revisionNo_key" ON "KnowledgeArticleRevision"("articleId", "revisionNo");

-- CreateIndex
CREATE INDEX "FormLayoutVersion_formLayoutId_status_createdAt_idx" ON "FormLayoutVersion"("formLayoutId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormLayoutVersion_formLayoutId_version_key" ON "FormLayoutVersion"("formLayoutId", "version");

-- CreateIndex
CREATE INDEX "PropertyOverrideRule_tenantId_companyId_entityType_target_i_idx" ON "PropertyOverrideRule"("tenantId", "companyId", "entityType", "target", "isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyOverrideRule_tenantId_companyId_entityType_target_k_key" ON "PropertyOverrideRule"("tenantId", "companyId", "entityType", "target", "key");

-- CreateIndex
CREATE INDEX "AutomationRuleRun_tenantId_companyId_status_createdAt_idx" ON "AutomationRuleRun"("tenantId", "companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationRuleRun_tenantId_companyId_entityType_entityId_cr_idx" ON "AutomationRuleRun"("tenantId", "companyId", "entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "DunningNotice" ADD CONSTRAINT "DunningNotice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DunningNotice" ADD CONSTRAINT "DunningNotice_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivableAgingSnapshot" ADD CONSTRAINT "ReceivableAgingSnapshot_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivableAgingSnapshot" ADD CONSTRAINT "ReceivableAgingSnapshot_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_paidFromAccountId_fkey" FOREIGN KEY ("paidFromAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_paidToAccountId_fkey" FOREIGN KEY ("paidToAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_paymentEntryId_fkey" FOREIGN KEY ("paymentEntryId") REFERENCES "PaymentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayableAgingSnapshot" ADD CONSTRAINT "PayableAgingSnapshot_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayableAgingSnapshot" ADD CONSTRAINT "PayableAgingSnapshot_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayableAgingSnapshot" ADD CONSTRAINT "PayableAgingSnapshot_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "SupplierPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityFeedback" ADD CONSTRAINT "QualityFeedback_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "QualityGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBillingEntry" ADD CONSTRAINT "ProjectBillingEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBillingEntry" ADD CONSTRAINT "ProjectBillingEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBillingEntry" ADD CONSTRAINT "ProjectBillingEntry_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticleRevision" ADD CONSTRAINT "KnowledgeArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormLayoutVersion" ADD CONSTRAINT "FormLayoutVersion_formLayoutId_fkey" FOREIGN KEY ("formLayoutId") REFERENCES "FormLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRuleRun" ADD CONSTRAINT "AutomationRuleRun_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

