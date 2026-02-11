-- Inventory platform extension (multi-warehouse docs, workflow, custom fields, presets, attachments, jobs).

-- Enums
DO $$ BEGIN
  CREATE TYPE "InventoryCustomFieldEntityType" AS ENUM ('ITEM', 'WAREHOUSE', 'LOCATION', 'DOCUMENT', 'DOCUMENT_LINE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryCustomFieldType" AS ENUM (
    'TEXT',
    'TEXTAREA',
    'NUMBER',
    'CURRENCY',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'SELECT',
    'MULTISELECT',
    'USER',
    'REFERENCE',
    'JSON',
    'BARCODE'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryDocumentType" AS ENUM ('ADJUSTMENT', 'TRANSFER', 'RECEIPT', 'ISSUE', 'COUNT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'POSTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryPresetScope" AS ENUM ('USER', 'ROLE', 'COMPANY');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAttachmentEntityType" AS ENUM ('ITEM', 'DOCUMENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryImportJobStatus" AS ENUM ('PENDING', 'VALIDATED', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Multi-company context
CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug");

CREATE TABLE IF NOT EXISTS "CompanyMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMembership_userId_companyId_key" ON "CompanyMembership"("userId", "companyId");
CREATE INDEX IF NOT EXISTS "CompanyMembership_companyId_role_idx" ON "CompanyMembership"("companyId", "role");

DO $$ BEGIN
  ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Inventory company settings
CREATE TABLE IF NOT EXISTS "InventoryCompanySetting" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "trackByLocation" BOOLEAN NOT NULL DEFAULT false,
  "preventNegativeStock" BOOLEAN NOT NULL DEFAULT true,
  "allowNegativeOverride" BOOLEAN NOT NULL DEFAULT false,
  "costingMethod" TEXT NOT NULL DEFAULT 'AVG',
  "baseCurrency" TEXT NOT NULL DEFAULT 'BDT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCompanySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCompanySetting_orgId_key" ON "InventoryCompanySetting"("orgId");

-- Warehouses and nested locations
CREATE TABLE IF NOT EXISTS "InventoryWarehouse" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryWarehouse_orgId_code_key" ON "InventoryWarehouse"("orgId", "code");
CREATE INDEX IF NOT EXISTS "InventoryWarehouse_orgId_isActive_idx" ON "InventoryWarehouse"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "InventoryWarehouseLocation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "parentId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "path" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryWarehouseLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryWarehouseLocation_orgId_warehouseId_code_key" ON "InventoryWarehouseLocation"("orgId", "warehouseId", "code");
CREATE INDEX IF NOT EXISTS "InventoryWarehouseLocation_orgId_warehouseId_parentId_idx" ON "InventoryWarehouseLocation"("orgId", "warehouseId", "parentId");

DO $$ BEGIN
  ALTER TABLE "InventoryWarehouseLocation" ADD CONSTRAINT "InventoryWarehouseLocation_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryWarehouseLocation" ADD CONSTRAINT "InventoryWarehouseLocation_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Identifiers
CREATE TABLE IF NOT EXISTS "InventoryItemIdentifier" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItemIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItemIdentifier_orgId_value_key" ON "InventoryItemIdentifier"("orgId", "value");
CREATE INDEX IF NOT EXISTS "InventoryItemIdentifier_orgId_itemId_kind_idx" ON "InventoryItemIdentifier"("orgId", "itemId", "kind");

DO $$ BEGIN
  ALTER TABLE "InventoryItemIdentifier" ADD CONSTRAINT "InventoryItemIdentifier_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Custom fields
CREATE TABLE IF NOT EXISTS "InventoryCustomFieldDefinition" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entityType" "InventoryCustomFieldEntityType" NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "fieldType" "InventoryCustomFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "unique" BOOLEAN NOT NULL DEFAULT false,
  "indexed" BOOLEAN NOT NULL DEFAULT false,
  "showInList" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "defaultValue" JSONB,
  "validationRules" JSONB,
  "visibilityRoles" JSONB,
  "computedExpr" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCustomFieldDefinition_orgId_entityType_key_key" ON "InventoryCustomFieldDefinition"("orgId", "entityType", "key");
CREATE INDEX IF NOT EXISTS "InventoryCustomFieldDefinition_orgId_entityType_isActive_idx" ON "InventoryCustomFieldDefinition"("orgId", "entityType", "isActive");

CREATE TABLE IF NOT EXISTS "InventoryCustomFieldValue" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entityType" "InventoryCustomFieldEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldDefinitionId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCustomFieldValue_orgId_entityType_entityId_fieldDefinitionId_key" ON "InventoryCustomFieldValue"("orgId", "entityType", "entityId", "fieldDefinitionId");
CREATE INDEX IF NOT EXISTS "InventoryCustomFieldValue_orgId_entityType_entityId_idx" ON "InventoryCustomFieldValue"("orgId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "InventoryCustomFieldValue_orgId_fieldDefinitionId_idx" ON "InventoryCustomFieldValue"("orgId", "fieldDefinitionId");

DO $$ BEGIN
  ALTER TABLE "InventoryCustomFieldValue" ADD CONSTRAINT "InventoryCustomFieldValue_fieldDefinitionId_fkey"
  FOREIGN KEY ("fieldDefinitionId") REFERENCES "InventoryCustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Saved views
CREATE TABLE IF NOT EXISTS "InventoryViewPreset" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "InventoryPresetScope" NOT NULL DEFAULT 'USER',
  "ownerUserId" TEXT,
  "role" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryViewPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryViewPreset_orgId_entity_scope_ownerUserId_idx" ON "InventoryViewPreset"("orgId", "entity", "scope", "ownerUserId");
CREATE INDEX IF NOT EXISTS "InventoryViewPreset_orgId_entity_scope_role_idx" ON "InventoryViewPreset"("orgId", "entity", "scope", "role");

-- Workflow definitions
CREATE TABLE IF NOT EXISTS "InventoryWorkflowDefinition" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "documentType" "InventoryDocumentType" NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryWorkflowDefinition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryWorkflowDefinition_orgId_documentType_isActive_idx" ON "InventoryWorkflowDefinition"("orgId", "documentType", "isActive");

-- Documents and lines
CREATE TABLE IF NOT EXISTS "InventoryDocument" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "documentType" "InventoryDocumentType" NOT NULL,
  "number" TEXT NOT NULL,
  "status" "InventoryDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceWarehouseId" TEXT,
  "sourceLocationId" TEXT,
  "destinationWarehouseId" TEXT,
  "destinationLocationId" TEXT,
  "workflowState" JSONB,
  "documentDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "externalRef" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "submittedAt" TIMESTAMP(3),
  "submittedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedBy" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  "postedAt" TIMESTAMP(3),
  "postedBy" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryDocument_orgId_number_key" ON "InventoryDocument"("orgId", "number");
CREATE INDEX IF NOT EXISTS "InventoryDocument_orgId_documentType_status_createdAt_idx" ON "InventoryDocument"("orgId", "documentType", "status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_sourceWarehouseId_fkey"
  FOREIGN KEY ("sourceWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_sourceLocationId_fkey"
  FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_destinationWarehouseId_fkey"
  FOREIGN KEY ("destinationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_destinationLocationId_fkey"
  FOREIGN KEY ("destinationLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryDocumentLine" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "lineNo" INTEGER NOT NULL,
  "itemId" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitCostMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "sourceWarehouseId" TEXT,
  "sourceLocationId" TEXT,
  "destinationWarehouseId" TEXT,
  "destinationLocationId" TEXT,
  "customData" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryDocumentLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryDocumentLine_orgId_documentId_idx" ON "InventoryDocumentLine"("orgId", "documentId");
CREATE INDEX IF NOT EXISTS "InventoryDocumentLine_orgId_itemId_idx" ON "InventoryDocumentLine"("orgId", "itemId");

DO $$ BEGIN
  ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "InventoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceWarehouseId_fkey"
  FOREIGN KEY ("sourceWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceLocationId_fkey"
  FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_destinationWarehouseId_fkey"
  FOREIGN KEY ("destinationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_destinationLocationId_fkey"
  FOREIGN KEY ("destinationLocationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryWorkflowState" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "currentStatus" "InventoryDocumentStatus" NOT NULL,
  "steps" JSONB NOT NULL,
  "lastAction" TEXT,
  "lastActionBy" TEXT,
  "lastActionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryWorkflowState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryWorkflowState_documentId_key" ON "InventoryWorkflowState"("documentId");
CREATE INDEX IF NOT EXISTS "InventoryWorkflowState_orgId_currentStatus_idx" ON "InventoryWorkflowState"("orgId", "currentStatus");

DO $$ BEGIN
  ALTER TABLE "InventoryWorkflowState" ADD CONSTRAINT "InventoryWorkflowState_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "InventoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Immutable ledger + derived balances
CREATE TABLE IF NOT EXISTS "InventoryLedgerEntry" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "documentId" TEXT,
  "documentLineId" TEXT,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "quantityDelta" INTEGER NOT NULL,
  "unitCostMinor" INTEGER,
  "totalCostMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "postingTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_itemId_postingTime_idx" ON "InventoryLedgerEntry"("orgId", "itemId", "postingTime");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_warehouseId_locationId_idx" ON "InventoryLedgerEntry"("orgId", "warehouseId", "locationId");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_documentId_idx" ON "InventoryLedgerEntry"("orgId", "documentId");

DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "InventoryDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_documentLineId_fkey"
  FOREIGN KEY ("documentLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryStockBalance" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "onHand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "incoming" INTEGER NOT NULL DEFAULT 0,
  "outgoing" INTEGER NOT NULL DEFAULT 0,
  "avgCostMinor" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryStockBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryStockBalance_orgId_itemId_warehouseId_locationId_key" ON "InventoryStockBalance"("orgId", "itemId", "warehouseId", "locationId");
CREATE INDEX IF NOT EXISTS "InventoryStockBalance_orgId_warehouseId_locationId_idx" ON "InventoryStockBalance"("orgId", "warehouseId", "locationId");
CREATE INDEX IF NOT EXISTS "InventoryStockBalance_orgId_itemId_idx" ON "InventoryStockBalance"("orgId", "itemId");

DO $$ BEGIN
  ALTER TABLE "InventoryStockBalance" ADD CONSTRAINT "InventoryStockBalance_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryStockBalance" ADD CONSTRAINT "InventoryStockBalance_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryStockBalance" ADD CONSTRAINT "InventoryStockBalance_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Reorder rules and suggestions inputs
CREATE TABLE IF NOT EXISTS "InventoryReorderRule" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "minQty" INTEGER NOT NULL DEFAULT 0,
  "maxQty" INTEGER NOT NULL DEFAULT 0,
  "reorderPoint" INTEGER NOT NULL DEFAULT 0,
  "reorderQty" INTEGER NOT NULL DEFAULT 0,
  "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
  "preferredVendorId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryReorderRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryReorderRule_orgId_itemId_warehouseId_locationId_key" ON "InventoryReorderRule"("orgId", "itemId", "warehouseId", "locationId");
CREATE INDEX IF NOT EXISTS "InventoryReorderRule_orgId_warehouseId_isActive_idx" ON "InventoryReorderRule"("orgId", "warehouseId", "isActive");

DO $$ BEGIN
  ALTER TABLE "InventoryReorderRule" ADD CONSTRAINT "InventoryReorderRule_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryReorderRule" ADD CONSTRAINT "InventoryReorderRule_warehouseId_fkey"
  FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryReorderRule" ADD CONSTRAINT "InventoryReorderRule_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryReorderRule" ADD CONSTRAINT "InventoryReorderRule_preferredVendorId_fkey"
  FOREIGN KEY ("preferredVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Attachments
CREATE TABLE IF NOT EXISTS "InventoryAttachment" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entityType" "InventoryAttachmentEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "uploadedBy" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  CONSTRAINT "InventoryAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryAttachment_orgId_storageKey_key" ON "InventoryAttachment"("orgId", "storageKey");
CREATE INDEX IF NOT EXISTS "InventoryAttachment_orgId_entityType_entityId_idx" ON "InventoryAttachment"("orgId", "entityType", "entityId");

-- Import/export jobs
CREATE TABLE IF NOT EXISTS "InventoryImportJob" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "status" "InventoryImportJobStatus" NOT NULL DEFAULT 'PENDING',
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT,
  "summary" JSONB,
  "createdBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryImportJob_orgId_status_createdAt_idx" ON "InventoryImportJob"("orgId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "InventoryImportJobRowError" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "field" TEXT,
  "message" TEXT NOT NULL,
  "rawData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryImportJobRowError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryImportJobRowError_jobId_rowNumber_idx" ON "InventoryImportJobRowError"("jobId", "rowNumber");

DO $$ BEGIN
  ALTER TABLE "InventoryImportJobRowError" ADD CONSTRAINT "InventoryImportJobRowError_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "InventoryImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryExportJob" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "status" "InventoryExportJobStatus" NOT NULL DEFAULT 'PENDING',
  "format" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "filters" JSONB,
  "outputKey" TEXT,
  "createdBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryExportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryExportJob_orgId_status_createdAt_idx" ON "InventoryExportJob"("orgId", "status", "createdAt");

-- Posting idempotency
CREATE TABLE IF NOT EXISTS "InventoryIdempotencyKey" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT,
  "response" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryIdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryIdempotencyKey_orgId_scope_key_key" ON "InventoryIdempotencyKey"("orgId", "scope", "key");
CREATE INDEX IF NOT EXISTS "InventoryIdempotencyKey_orgId_createdAt_idx" ON "InventoryIdempotencyKey"("orgId", "createdAt");

-- Inventory-focused audit + notifications
CREATE TABLE IF NOT EXISTS "InventoryAuditLog" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "diff" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryAuditLog_orgId_createdAt_idx" ON "InventoryAuditLog"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryAuditLog_orgId_entityType_entityId_idx" ON "InventoryAuditLog"("orgId", "entityType", "entityId");

CREATE TABLE IF NOT EXISTS "InventoryNotification" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "payload" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryNotification_orgId_readAt_createdAt_idx" ON "InventoryNotification"("orgId", "readAt", "createdAt");

CREATE TABLE IF NOT EXISTS "InventoryWebhookSubscription" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "secret" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryWebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryWebhookSubscription_orgId_eventType_isActive_idx" ON "InventoryWebhookSubscription"("orgId", "eventType", "isActive");

CREATE TABLE IF NOT EXISTS "InventoryLabelTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "paperType" TEXT NOT NULL,
  "widthMm" DOUBLE PRECISION,
  "heightMm" DOUBLE PRECISION,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLabelTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryLabelTemplate_orgId_name_key" ON "InventoryLabelTemplate"("orgId", "name");
CREATE INDEX IF NOT EXISTS "InventoryLabelTemplate_orgId_paperType_isDefault_idx" ON "InventoryLabelTemplate"("orgId", "paperType", "isDefault");
