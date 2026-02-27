-- Module L: inventory ledger/costing/ops baseline

-- Enums
ALTER TYPE "InventoryValuationMethod" ADD VALUE IF NOT EXISTS 'STANDARD';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryOutboxEventStatus') THEN
    CREATE TYPE "InventoryOutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InventoryOpsJobStatus') THEN
    CREATE TYPE "InventoryOpsJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
  END IF;
END $$;

-- Posting sequence
CREATE SEQUENCE IF NOT EXISTS inventory_ledger_posting_seq;

ALTER TABLE "InventoryLedgerEntry"
  ADD COLUMN IF NOT EXISTS "postingSeq" BIGINT,
  ADD COLUMN IF NOT EXISTS "transferGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "reversalOfLedgerEntryId" TEXT;

WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "postingTime" ASC, "createdAt" ASC, "id" ASC) AS rn
  FROM "InventoryLedgerEntry"
)
UPDATE "InventoryLedgerEntry" e
SET "postingSeq" = ordered.rn
FROM ordered
WHERE e."id" = ordered."id"
  AND e."postingSeq" IS NULL;

ALTER TABLE "InventoryLedgerEntry"
  ALTER COLUMN "postingSeq" SET DEFAULT nextval('inventory_ledger_posting_seq'),
  ALTER COLUMN "postingSeq" SET NOT NULL;

SELECT setval(
  'inventory_ledger_posting_seq',
  COALESCE((SELECT MAX("postingSeq") FROM "InventoryLedgerEntry"), 1),
  true
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_postingSeq_key"
  ON "InventoryLedgerEntry"("orgId", "postingSeq");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_postingSeq_idx"
  ON "InventoryLedgerEntry"("orgId", "postingSeq");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_transferGroupId_idx"
  ON "InventoryLedgerEntry"("orgId", "transferGroupId");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_reversalOfLedgerEntryId_idx"
  ON "InventoryLedgerEntry"("orgId", "reversalOfLedgerEntryId");

-- Cost layers: batch/serial/source-ledger dimensions
ALTER TABLE "InventoryCostLayer"
  ADD COLUMN IF NOT EXISTS "sourceLedgerEntryId" TEXT,
  ADD COLUMN IF NOT EXISTS "batchId" TEXT,
  ADD COLUMN IF NOT EXISTS "serialId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryCostLayer_batchId_fkey') THEN
    ALTER TABLE "InventoryCostLayer"
      ADD CONSTRAINT "InventoryCostLayer_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryCostLayer_serialId_fkey') THEN
    ALTER TABLE "InventoryCostLayer"
      ADD CONSTRAINT "InventoryCostLayer_serialId_fkey"
      FOREIGN KEY ("serialId") REFERENCES "InventorySerial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryCostLayer_orgId_sourceLedgerEntryId_idx"
  ON "InventoryCostLayer"("orgId", "sourceLedgerEntryId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_orgId_batchId_idx"
  ON "InventoryCostLayer"("orgId", "batchId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_orgId_serialId_idx"
  ON "InventoryCostLayer"("orgId", "serialId");

-- FIFO allocations
CREATE TABLE IF NOT EXISTS "InventoryCostLayerAllocation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "transferGroupId" TEXT,
  "sourceLayerId" TEXT NOT NULL,
  "destinationLayerId" TEXT,
  "documentId" TEXT,
  "documentLineId" TEXT,
  "ledgerEntryId" TEXT,
  "movementKind" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "unitCostMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryCostLayerAllocation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryCostLayerAllocation_sourceLayerId_fkey') THEN
    ALTER TABLE "InventoryCostLayerAllocation"
      ADD CONSTRAINT "InventoryCostLayerAllocation_sourceLayerId_fkey"
      FOREIGN KEY ("sourceLayerId") REFERENCES "InventoryCostLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryCostLayerAllocation_destinationLayerId_fkey') THEN
    ALTER TABLE "InventoryCostLayerAllocation"
      ADD CONSTRAINT "InventoryCostLayerAllocation_destinationLayerId_fkey"
      FOREIGN KEY ("destinationLayerId") REFERENCES "InventoryCostLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryCostLayerAllocation_documentId_fkey') THEN
    ALTER TABLE "InventoryCostLayerAllocation"
      ADD CONSTRAINT "InventoryCostLayerAllocation_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "InventoryDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryCostLayerAllocation_documentLineId_fkey') THEN
    ALTER TABLE "InventoryCostLayerAllocation"
      ADD CONSTRAINT "InventoryCostLayerAllocation_documentLineId_fkey"
      FOREIGN KEY ("documentLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryCostLayerAllocation_ledgerEntryId_fkey') THEN
    ALTER TABLE "InventoryCostLayerAllocation"
      ADD CONSTRAINT "InventoryCostLayerAllocation_ledgerEntryId_fkey"
      FOREIGN KEY ("ledgerEntryId") REFERENCES "InventoryLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryCostLayerAllocation_orgId_transferGroupId_idx"
  ON "InventoryCostLayerAllocation"("orgId", "transferGroupId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayerAllocation_orgId_sourceLayerId_idx"
  ON "InventoryCostLayerAllocation"("orgId", "sourceLayerId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayerAllocation_orgId_destinationLayerId_idx"
  ON "InventoryCostLayerAllocation"("orgId", "destinationLayerId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayerAllocation_orgId_documentId_idx"
  ON "InventoryCostLayerAllocation"("orgId", "documentId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayerAllocation_orgId_ledgerEntryId_idx"
  ON "InventoryCostLayerAllocation"("orgId", "ledgerEntryId");

-- Stock value column
ALTER TABLE "InventoryStockBalance"
  ADD COLUMN IF NOT EXISTS "stockValueMinor" INTEGER NOT NULL DEFAULT 0;

-- Serial specific-id receipt costing
ALTER TABLE "InventorySerial"
  ADD COLUMN IF NOT EXISTS "receiptUnitCostMinor" INTEGER,
  ADD COLUMN IF NOT EXISTS "receiptCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptLedgerEntryId" TEXT;

CREATE INDEX IF NOT EXISTS "InventorySerial_orgId_receiptLedgerEntryId_idx"
  ON "InventorySerial"("orgId", "receiptLedgerEntryId");

-- Inventory outbox
CREATE TABLE IF NOT EXISTS "InventoryOutboxEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "headers" JSONB,
  "status" "InventoryOutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryOutboxEvent_orgId_status_availableAt_idx"
  ON "InventoryOutboxEvent"("orgId", "status", "availableAt");
CREATE INDEX IF NOT EXISTS "InventoryOutboxEvent_orgId_topic_createdAt_idx"
  ON "InventoryOutboxEvent"("orgId", "topic", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryOutboxEvent_orgId_topic_idempotencyKey_key"
  ON "InventoryOutboxEvent"("orgId", "topic", "idempotencyKey");

-- Stock closing
CREATE TABLE IF NOT EXISTS "InventoryStockClosing" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "InventoryOpsJobStatus" NOT NULL DEFAULT 'QUEUED',
  "scope" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryStockClosing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryStockClosing_orgId_status_createdAt_idx"
  ON "InventoryStockClosing"("orgId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryStockClosing_orgId_periodStart_periodEnd_idx"
  ON "InventoryStockClosing"("orgId", "periodStart", "periodEnd");

CREATE TABLE IF NOT EXISTS "InventoryStockClosingLine" (
  "id" TEXT NOT NULL,
  "closingId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "batchId" TEXT,
  "qtyOnHand" INTEGER NOT NULL,
  "stockValueMinor" INTEGER NOT NULL,
  "avgCostMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryStockClosingLine_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryStockClosingLine_closingId_fkey') THEN
    ALTER TABLE "InventoryStockClosingLine"
      ADD CONSTRAINT "InventoryStockClosingLine_closingId_fkey"
      FOREIGN KEY ("closingId") REFERENCES "InventoryStockClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryStockClosingLine_itemId_fkey') THEN
    ALTER TABLE "InventoryStockClosingLine"
      ADD CONSTRAINT "InventoryStockClosingLine_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryStockClosingLine_warehouseId_fkey') THEN
    ALTER TABLE "InventoryStockClosingLine"
      ADD CONSTRAINT "InventoryStockClosingLine_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryStockClosingLine_locationId_fkey') THEN
    ALTER TABLE "InventoryStockClosingLine"
      ADD CONSTRAINT "InventoryStockClosingLine_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryStockClosingLine_batchId_fkey') THEN
    ALTER TABLE "InventoryStockClosingLine"
      ADD CONSTRAINT "InventoryStockClosingLine_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryStockClosingLine_orgId_item_warehouse_location_batch_idx"
  ON "InventoryStockClosingLine"("orgId", "itemId", "warehouseId", "locationId", "batchId");
CREATE INDEX IF NOT EXISTS "InventoryStockClosingLine_closingId_idx"
  ON "InventoryStockClosingLine"("closingId");

-- Inventory ops jobs
CREATE TABLE IF NOT EXISTS "InventoryOpsJob" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "status" "InventoryOpsJobStatus" NOT NULL DEFAULT 'QUEUED',
  "payload" JSONB,
  "result" JSONB,
  "progressPct" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "queueJobId" TEXT,
  "error" TEXT,
  "createdBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryOpsJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryOpsJob_orgId_jobType_jobKey_key"
  ON "InventoryOpsJob"("orgId", "jobType", "jobKey");
CREATE INDEX IF NOT EXISTS "InventoryOpsJob_orgId_status_createdAt_idx"
  ON "InventoryOpsJob"("orgId", "status", "createdAt");
