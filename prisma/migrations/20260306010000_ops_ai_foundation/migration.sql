-- CreateEnum
CREATE TYPE "AuditEventOrigin" AS ENUM ('HUMAN', 'AUTOMATION', 'AI');

-- CreateEnum
CREATE TYPE "OpsTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OpsTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpsExceptionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OpsExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OpsActionExecutionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REPLAYED');

-- CreateEnum
CREATE TYPE "AiRecommendationStatus" AS ENUM ('ACTIVE', 'APPLIED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiResolutionDraftStatus" AS ENUM ('DRAFT', 'APPLIED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AiFeedbackType" AS ENUM ('ACCEPT', 'EDIT', 'REJECT');

-- CreateEnum
CREATE TYPE "WorkflowPolicyMode" AS ENUM ('STRICT', 'BALANCED', 'HIGH_THROUGHPUT');

-- AlterTable
ALTER TABLE "AuditEvent"
ADD COLUMN "origin" "AuditEventOrigin" NOT NULL DEFAULT 'HUMAN',
ADD COLUMN "decisionTrace" JSONB;

-- CreateTable
CREATE TABLE "OpsTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "priority" "OpsTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "OpsTaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "assigneeUserId" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" "OpsExceptionSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "OpsExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsActionExecution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "commandKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "status" "OpsActionExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "reversibleState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsActionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRecommendation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "contextRef" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" JSONB,
    "actionId" TEXT NOT NULL,
    "actionLabel" TEXT NOT NULL,
    "status" "AiRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiResolutionDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "contextRef" TEXT NOT NULL,
    "draftText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourceSignals" JSONB,
    "expectedImpact" JSONB,
    "rollbackPlan" JSONB,
    "status" "AiResolutionDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiResolutionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFeedbackEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "draftId" TEXT,
    "actorUserId" TEXT,
    "feedbackType" "AiFeedbackType" NOT NULL,
    "reason" TEXT,
    "signal" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFeedbackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowPolicyProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "WorkflowPolicyMode" NOT NULL DEFAULT 'BALANCED',
    "strictness" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowPolicyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformFeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsTask_tenantId_companyId_status_priority_idx"
ON "OpsTask"("tenantId", "companyId", "status", "priority");

-- CreateIndex
CREATE INDEX "OpsTask_tenantId_companyId_dueAt_createdAt_idx"
ON "OpsTask"("tenantId", "companyId", "dueAt", "createdAt");

-- CreateIndex
CREATE INDEX "OpsException_tenantId_companyId_status_severity_idx"
ON "OpsException"("tenantId", "companyId", "status", "severity");

-- CreateIndex
CREATE INDEX "OpsException_tenantId_companyId_detectedAt_createdAt_idx"
ON "OpsException"("tenantId", "companyId", "detectedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpsActionExecution_tenantId_companyId_idempotencyKey_key"
ON "OpsActionExecution"("tenantId", "companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OpsActionExecution_tenantId_companyId_status_createdAt_idx"
ON "OpsActionExecution"("tenantId", "companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OpsActionExecution_tenantId_companyId_actionId_createdAt_idx"
ON "OpsActionExecution"("tenantId", "companyId", "actionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiRecommendation_tenantId_companyId_role_status_createdAt_idx"
ON "AiRecommendation"("tenantId", "companyId", "role", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiRecommendation_tenantId_companyId_contextType_contextRef_creat_idx"
ON "AiRecommendation"("tenantId", "companyId", "contextType", "contextRef", "createdAt");

-- CreateIndex
CREATE INDEX "AiResolutionDraft_tenantId_companyId_contextType_contextRef_sta_idx"
ON "AiResolutionDraft"("tenantId", "companyId", "contextType", "contextRef", "status");

-- CreateIndex
CREATE INDEX "AiFeedbackEvent_tenantId_companyId_feedbackType_createdAt_idx"
ON "AiFeedbackEvent"("tenantId", "companyId", "feedbackType", "createdAt");

-- CreateIndex
CREATE INDEX "AiFeedbackEvent_tenantId_companyId_recommendationId_createdAt_idx"
ON "AiFeedbackEvent"("tenantId", "companyId", "recommendationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowPolicyProfile_tenantId_companyId_key_key"
ON "WorkflowPolicyProfile"("tenantId", "companyId", "key");

-- CreateIndex
CREATE INDEX "WorkflowPolicyProfile_tenantId_companyId_isActive_idx"
ON "WorkflowPolicyProfile"("tenantId", "companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeatureFlag_tenantId_companyId_key_key"
ON "PlatformFeatureFlag"("tenantId", "companyId", "key");

-- CreateIndex
CREATE INDEX "PlatformFeatureFlag_tenantId_companyId_enabled_idx"
ON "PlatformFeatureFlag"("tenantId", "companyId", "enabled");
