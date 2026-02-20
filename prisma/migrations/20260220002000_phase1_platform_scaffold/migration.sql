-- Phase 1 platform scaffold: tenancy hierarchy, platform primitives, and no-code metadata.

DO $$ BEGIN
  CREATE TYPE "PlatformPermissionEffect" AS ENUM ('ALLOW', 'DENY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformScopeLevel" AS ENUM ('TENANT', 'COMPANY', 'BRANCH', 'WAREHOUSE', 'PROJECT', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformWorkflowDefinitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformWorkflowInstanceStatus" AS ENUM ('IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NumberSeriesResetPolicy" AS ENUM ('NEVER', 'FISCAL_YEAR', 'CALENDAR_YEAR', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportSourceType" AS ENUM ('ADAPTER', 'SQL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CustomFieldDataType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DATETIME', 'SELECT', 'LINK', 'TABLE', 'BOOLEAN', 'CURRENCY', 'JSON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationTrigger" AS ENUM ('ON_CREATE', 'ON_SUBMIT', 'ON_STATUS_CHANGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationActionType" AS ENUM ('SET_FIELD', 'CREATE_TASK', 'SEND_NOTIFICATION', 'CALL_WEBHOOK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "IamTenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "plan" TEXT,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_key_key" ON "Tenant"("key");

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

CREATE INDEX IF NOT EXISTS "Company_tenantId_isActive_idx" ON "Company"("tenantId", "isActive");

CREATE TABLE IF NOT EXISTS "TenantDomain" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" "IamDomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantDomain_domain_key" ON "TenantDomain"("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantDomain_tenantId_domain_key" ON "TenantDomain"("tenantId", "domain");
CREATE INDEX IF NOT EXISTS "TenantDomain_tenantId_isPrimary_idx" ON "TenantDomain"("tenantId", "isPrimary");

CREATE TABLE IF NOT EXISTS "RoleProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoleProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoleProfile_tenantId_name_key" ON "RoleProfile"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "RoleProfile_tenantId_isDefault_idx" ON "RoleProfile"("tenantId", "isDefault");

CREATE TABLE IF NOT EXISTS "TenantMembership" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "roleProfileId" TEXT,
  "status" "IamMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "joinedAt" TIMESTAMP(3),
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "TenantMembership_tenantId_role_idx" ON "TenantMembership"("tenantId", "role");

CREATE TABLE IF NOT EXISTS "PermissionRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "roleProfileId" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "effect" "PlatformPermissionEffect" NOT NULL DEFAULT 'ALLOW',
  "scopeLevel" "PlatformScopeLevel" NOT NULL DEFAULT 'COMPANY',
  "condition" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PermissionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PermissionRule_roleProfileId_module_resource_action_scopeLevel_key"
  ON "PermissionRule"("roleProfileId", "module", "resource", "action", "scopeLevel");
CREATE INDEX IF NOT EXISTS "PermissionRule_tenantId_module_resource_action_idx"
  ON "PermissionRule"("tenantId", "module", "resource", "action");

CREATE TABLE IF NOT EXISTS "RowScopeRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "roleProfileId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "scopeLevel" "PlatformScopeLevel" NOT NULL,
  "selector" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RowScopeRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RowScopeRule_tenantId_resource_scopeLevel_idx" ON "RowScopeRule"("tenantId", "resource", "scopeLevel");

CREATE TABLE IF NOT EXISTS "WorkflowDefinition" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "entityType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "PlatformWorkflowDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
  "initialState" TEXT NOT NULL,
  "terminalStates" JSONB,
  "config" JSONB NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkflowDefinition_tenantId_companyId_entityType_status_idx"
  ON "WorkflowDefinition"("tenantId", "companyId", "entityType", "status");

CREATE TABLE IF NOT EXISTS "WorkflowState" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isInitial" BOOLEAN NOT NULL DEFAULT FALSE,
  "isTerminal" BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowState_definitionId_key_key" ON "WorkflowState"("definitionId", "key");

CREATE TABLE IF NOT EXISTS "WorkflowTransition" (
  "id" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "fromState" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "minApprovals" INTEGER NOT NULL DEFAULT 1,
  "requiredPermissions" JSONB,
  "conditions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkflowTransition_definitionId_fromState_actionKey_idx"
  ON "WorkflowTransition"("definitionId", "fromState", "actionKey");

CREATE TABLE IF NOT EXISTS "WorkflowInstance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "definitionId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "currentState" TEXT NOT NULL,
  "status" "PlatformWorkflowInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "context" JSONB,
  "startedBy" TEXT,
  "completedBy" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowInstance_tenantId_companyId_entityType_entityId_key"
  ON "WorkflowInstance"("tenantId", "companyId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_tenantId_companyId_status_startedAt_idx"
  ON "WorkflowInstance"("tenantId", "companyId", "status", "startedAt");

CREATE TABLE IF NOT EXISTS "WorkflowAction" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "transitionId" TEXT,
  "actionKey" TEXT NOT NULL,
  "fromState" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "actedBy" TEXT,
  "comment" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkflowAction_instanceId_createdAt_idx" ON "WorkflowAction"("instanceId", "createdAt");

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "actorUserId" TEXT,
  "source" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditEvent_tenantId_companyId_createdAt_idx" ON "AuditEvent"("tenantId", "companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_tenantId_entityType_entityId_createdAt_idx" ON "AuditEvent"("tenantId", "entityType", "entityId", "createdAt");

CREATE TABLE IF NOT EXISTS "ImmutableLedgerEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "stream" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "previousHash" TEXT,
  "eventHash" TEXT NOT NULL,
  "metadata" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImmutableLedgerEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImmutableLedgerEvent_eventHash_key" ON "ImmutableLedgerEvent"("eventHash");
CREATE INDEX IF NOT EXISTS "ImmutableLedgerEvent_tenantId_companyId_stream_createdAt_idx"
  ON "ImmutableLedgerEvent"("tenantId", "companyId", "stream", "createdAt");
CREATE INDEX IF NOT EXISTS "ImmutableLedgerEvent_tenantId_entityType_entityId_createdAt_idx"
  ON "ImmutableLedgerEvent"("tenantId", "entityType", "entityId", "createdAt");

CREATE TABLE IF NOT EXISTS "OutboxEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "topic" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "headers" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboxEvent_tenantId_status_availableAt_idx" ON "OutboxEvent"("tenantId", "status", "availableAt");
CREATE INDEX IF NOT EXISTS "OutboxEvent_tenantId_topic_createdAt_idx" ON "OutboxEvent"("tenantId", "topic", "createdAt");

CREATE TABLE IF NOT EXISTS "NumberSeries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "resetPolicy" "NumberSeriesResetPolicy" NOT NULL DEFAULT 'NEVER',
  "startAt" INTEGER NOT NULL DEFAULT 1,
  "padding" INTEGER NOT NULL DEFAULT 4,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NumberSeries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NumberSeries_tenantId_companyId_key_key" ON "NumberSeries"("tenantId", "companyId", "key");
CREATE INDEX IF NOT EXISTS "NumberSeries_tenantId_isActive_idx" ON "NumberSeries"("tenantId", "isActive");

CREATE TABLE IF NOT EXISTS "NumberSeriesCounter" (
  "id" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "currentValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NumberSeriesCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NumberSeriesCounter_seriesId_periodKey_key" ON "NumberSeriesCounter"("seriesId", "periodKey");

CREATE TABLE IF NOT EXISTS "ReportDefinition" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sourceType" "ReportSourceType" NOT NULL DEFAULT 'ADAPTER',
  "sourceRef" TEXT NOT NULL,
  "schema" JSONB,
  "defaultFilters" JSONB,
  "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReportDefinition_tenantId_companyId_key_key" ON "ReportDefinition"("tenantId", "companyId", "key");
CREATE INDEX IF NOT EXISTS "ReportDefinition_tenantId_companyId_isActive_idx" ON "ReportDefinition"("tenantId", "companyId", "isActive");

CREATE TABLE IF NOT EXISTS "ReportView" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "reportDefinitionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "filters" JSONB,
  "columns" JSONB,
  "sort" JSONB,
  "visibility" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReportView_tenantId_companyId_reportDefinitionId_idx" ON "ReportView"("tenantId", "companyId", "reportDefinitionId");

CREATE TABLE IF NOT EXISTS "ReportSchedule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "reportDefinitionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "frequency" "ReportScheduleFrequency" NOT NULL,
  "cronExpr" TEXT,
  "timezone" TEXT,
  "recipients" JSONB NOT NULL,
  "filters" JSONB,
  "outputFormat" TEXT NOT NULL DEFAULT 'CSV',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReportSchedule_tenantId_companyId_isActive_nextRunAt_idx"
  ON "ReportSchedule"("tenantId", "companyId", "isActive", "nextRunAt");

CREATE TABLE IF NOT EXISTS "CustomField" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "entityType" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "dataType" "CustomFieldDataType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT FALSE,
  "unique" BOOLEAN NOT NULL DEFAULT FALSE,
  "showInList" BOOLEAN NOT NULL DEFAULT FALSE,
  "readOnly" BOOLEAN NOT NULL DEFAULT FALSE,
  "isHidden" BOOLEAN NOT NULL DEFAULT FALSE,
  "options" JSONB,
  "defaultValue" JSONB,
  "permissions" JSONB,
  "validation" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomField_tenantId_companyId_entityType_fieldKey_key"
  ON "CustomField"("tenantId", "companyId", "entityType", "fieldKey");
CREATE INDEX IF NOT EXISTS "CustomField_tenantId_companyId_entityType_isActive_idx"
  ON "CustomField"("tenantId", "companyId", "entityType", "isActive");

CREATE TABLE IF NOT EXISTS "FormLayout" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "entityType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "layout" JSONB NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FormLayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FormLayout_tenantId_companyId_entityType_isActive_idx"
  ON "FormLayout"("tenantId", "companyId", "entityType", "isActive");

CREATE TABLE IF NOT EXISTS "ValidationRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "entityType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "expression" TEXT,
  "config" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ValidationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ValidationRule_tenantId_companyId_entityType_isActive_idx"
  ON "ValidationRule"("tenantId", "companyId", "entityType", "isActive");

CREATE TABLE IF NOT EXISTS "PrintTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "entityType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "templateHtml" TEXT NOT NULL,
  "css" TEXT,
  "variablesSchema" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrintTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrintTemplate_tenantId_companyId_entityType_name_key"
  ON "PrintTemplate"("tenantId", "companyId", "entityType", "name");
CREATE INDEX IF NOT EXISTS "PrintTemplate_tenantId_companyId_entityType_isActive_idx"
  ON "PrintTemplate"("tenantId", "companyId", "entityType", "isActive");

CREATE TABLE IF NOT EXISTS "AutomationRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "entityType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" "AutomationTrigger" NOT NULL,
  "condition" JSONB,
  "actionType" "AutomationActionType" NOT NULL,
  "actionConfig" JSONB NOT NULL,
  "runAsRole" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutomationRule_tenantId_companyId_entityType_trigger_isActive_idx"
  ON "AutomationRule"("tenantId", "companyId", "entityType", "trigger", "isActive");

-- Backfill one tenant per existing company to keep legacy behavior valid.
INSERT INTO "Tenant" ("id", "key", "name", "status", "createdAt", "updatedAt")
SELECT
  CONCAT('tn_', c.id) AS id,
  COALESCE(NULLIF(c.slug, ''), CONCAT('tenant-', c.id)) AS key,
  c.name,
  'ACTIVE'::"IamTenantStatus",
  NOW(),
  NOW()
FROM "Company" c
ON CONFLICT ("key") DO NOTHING;

UPDATE "Company" c
SET "tenantId" = t.id
FROM "Tenant" t
WHERE c."tenantId" IS NULL
  AND t."key" = COALESCE(NULLIF(c.slug, ''), CONCAT('tenant-', c.id));

INSERT INTO "TenantDomain" ("id", "tenantId", "domain", "isPrimary", "status", "verifiedAt", "createdAt", "updatedAt")
SELECT
  CONCAT('td_', c.id) AS id,
  c."tenantId",
  c."primaryDomain",
  TRUE,
  c."domainVerificationStatus",
  CASE WHEN c."domainVerificationStatus" = 'VERIFIED'::"IamDomainVerificationStatus" THEN NOW() ELSE NULL END,
  NOW(),
  NOW()
FROM "Company" c
WHERE c."tenantId" IS NOT NULL
  AND c."primaryDomain" IS NOT NULL
  AND c."primaryDomain" <> ''
ON CONFLICT ("domain") DO NOTHING;

-- Foreign keys (guarded to avoid duplicate constraint failures).
DO $$ BEGIN
  ALTER TABLE "Company"
    ADD CONSTRAINT "Company_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantDomain"
    ADD CONSTRAINT "TenantDomain_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RoleProfile"
    ADD CONSTRAINT "RoleProfile_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantMembership"
    ADD CONSTRAINT "TenantMembership_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantMembership"
    ADD CONSTRAINT "TenantMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantMembership"
    ADD CONSTRAINT "TenantMembership_roleProfileId_fkey"
    FOREIGN KEY ("roleProfileId") REFERENCES "RoleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PermissionRule"
    ADD CONSTRAINT "PermissionRule_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PermissionRule"
    ADD CONSTRAINT "PermissionRule_roleProfileId_fkey"
    FOREIGN KEY ("roleProfileId") REFERENCES "RoleProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RowScopeRule"
    ADD CONSTRAINT "RowScopeRule_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RowScopeRule"
    ADD CONSTRAINT "RowScopeRule_roleProfileId_fkey"
    FOREIGN KEY ("roleProfileId") REFERENCES "RoleProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowState"
    ADD CONSTRAINT "WorkflowState_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowTransition"
    ADD CONSTRAINT "WorkflowTransition_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowInstance"
    ADD CONSTRAINT "WorkflowInstance_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowAction"
    ADD CONSTRAINT "WorkflowAction_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowAction"
    ADD CONSTRAINT "WorkflowAction_transitionId_fkey"
    FOREIGN KEY ("transitionId") REFERENCES "WorkflowTransition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NumberSeriesCounter"
    ADD CONSTRAINT "NumberSeriesCounter_seriesId_fkey"
    FOREIGN KEY ("seriesId") REFERENCES "NumberSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReportView"
    ADD CONSTRAINT "ReportView_reportDefinitionId_fkey"
    FOREIGN KEY ("reportDefinitionId") REFERENCES "ReportDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReportSchedule"
    ADD CONSTRAINT "ReportSchedule_reportDefinitionId_fkey"
    FOREIGN KEY ("reportDefinitionId") REFERENCES "ReportDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
