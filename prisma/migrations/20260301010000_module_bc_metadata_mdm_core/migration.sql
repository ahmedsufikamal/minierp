CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "barcode" TEXT,
  ADD COLUMN IF NOT EXISTS "itemType" TEXT,
  ADD COLUMN IF NOT EXISTS "itemStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "customData" JSONB;

ALTER TABLE "NumberSeries"
  ADD COLUMN IF NOT EXISTS "lastResetYear" INTEGER;

CREATE TABLE IF NOT EXISTS "MetaModel" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isCore" BOOLEAN NOT NULL DEFAULT false,
  "latestVersion" INTEGER NOT NULL DEFAULT 1,
  "publishedVersion" INTEGER NOT NULL DEFAULT 0,
  "draftConfig" JSONB,
  "publishedConfig" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaFieldDef" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "metaModelId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "dataType" "CustomFieldDataType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "unique" BOOLEAN NOT NULL DEFAULT false,
  "readOnly" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "baseField" TEXT,
  "defaultValue" JSONB,
  "options" JSONB,
  "ui" JSONB,
  "validation" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaFieldDef_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaWorkflowDef" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "metaModelId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaWorkflowDef_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaWorkflowState" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workflowDefId" TEXT NOT NULL,
  "stateKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isInitial" BOOLEAN NOT NULL DEFAULT false,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaWorkflowState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaWorkflowTransition" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workflowDefId" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "fromState" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "requiredPermissions" JSONB,
  "conditions" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaWorkflowTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaPrintTemplate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "metaModelId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "templateType" TEXT NOT NULL DEFAULT 'HTML',
  "draftTemplate" TEXT NOT NULL,
  "publishedTemplate" TEXT,
  "draftCss" TEXT,
  "publishedCss" TEXT,
  "variablesSchema" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedVersion" INTEGER NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaPrintTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaPermissionPolicy" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "metaModelId" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "effect" "PlatformPermissionEffect" NOT NULL DEFAULT 'ALLOW',
  "requiredPermissions" JSONB,
  "conditionExpr" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaPermissionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaCustomPermissionType" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "metaModelId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaCustomPermissionType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MetaChangeLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "diff" JSONB,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "sourceIp" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetaChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompiledMeta" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "metaModelId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "etag" TEXT NOT NULL,
  "validationSchema" JSONB NOT NULL,
  "uiSchema" JSONB NOT NULL,
  "searchHints" JSONB,
  "permissionSummary" JSONB,
  "workflowSummary" JSONB,
  "indexHints" JSONB,
  "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "compiledBy" TEXT,
  CONSTRAINT "CompiledMeta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterParty" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partyCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "displayName" TEXT,
  "partyType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "taxId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "tags" JSONB,
  "customData" JSONB,
  "dedupFingerprint" TEXT,
  "mergedIntoPartyId" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterAddress" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "addressType" TEXT NOT NULL DEFAULT 'BILLING',
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT,
  "state" TEXT,
  "postalCode" TEXT,
  "country" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterContact" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "fullName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "designation" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterPartyMergeHistory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sourcePartyId" TEXT NOT NULL,
  "targetPartyId" TEXT NOT NULL,
  "changedFields" JSONB,
  "note" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterPartyMergeHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterPriceList" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterPriceList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterPriceListItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "priceListId" TEXT NOT NULL,
  "itemCode" TEXT NOT NULL,
  "productId" TEXT,
  "uomId" TEXT,
  "minQty" DECIMAL(18,6),
  "rate" DECIMAL(18,6) NOT NULL,
  "currency" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterPriceListItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterCurrency" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT,
  "precision" INTEGER NOT NULL DEFAULT 2,
  "isBase" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterCurrency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MasterTaxCode" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rate" DECIMAL(8,4) NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'OUTPUT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MasterTaxCode_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "MetaFieldDef"
    ADD CONSTRAINT "MetaFieldDef_metaModelId_fkey"
    FOREIGN KEY ("metaModelId") REFERENCES "MetaModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MetaWorkflowDef"
    ADD CONSTRAINT "MetaWorkflowDef_metaModelId_fkey"
    FOREIGN KEY ("metaModelId") REFERENCES "MetaModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MetaWorkflowState"
    ADD CONSTRAINT "MetaWorkflowState_workflowDefId_fkey"
    FOREIGN KEY ("workflowDefId") REFERENCES "MetaWorkflowDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MetaWorkflowTransition"
    ADD CONSTRAINT "MetaWorkflowTransition_workflowDefId_fkey"
    FOREIGN KEY ("workflowDefId") REFERENCES "MetaWorkflowDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MetaPrintTemplate"
    ADD CONSTRAINT "MetaPrintTemplate_metaModelId_fkey"
    FOREIGN KEY ("metaModelId") REFERENCES "MetaModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MetaPermissionPolicy"
    ADD CONSTRAINT "MetaPermissionPolicy_metaModelId_fkey"
    FOREIGN KEY ("metaModelId") REFERENCES "MetaModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MetaCustomPermissionType"
    ADD CONSTRAINT "MetaCustomPermissionType_metaModelId_fkey"
    FOREIGN KEY ("metaModelId") REFERENCES "MetaModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompiledMeta"
    ADD CONSTRAINT "CompiledMeta_metaModelId_fkey"
    FOREIGN KEY ("metaModelId") REFERENCES "MetaModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MasterAddress"
    ADD CONSTRAINT "MasterAddress_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "MasterParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MasterContact"
    ADD CONSTRAINT "MasterContact_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "MasterParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MasterPartyMergeHistory"
    ADD CONSTRAINT "MasterPartyMergeHistory_sourcePartyId_fkey"
    FOREIGN KEY ("sourcePartyId") REFERENCES "MasterParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MasterPartyMergeHistory"
    ADD CONSTRAINT "MasterPartyMergeHistory_targetPartyId_fkey"
    FOREIGN KEY ("targetPartyId") REFERENCES "MasterParty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MasterPriceListItem"
    ADD CONSTRAINT "MasterPriceListItem_priceListId_fkey"
    FOREIGN KEY ("priceListId") REFERENCES "MasterPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
