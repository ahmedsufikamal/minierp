-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InventorySnapshotMode" AS ENUM ('OPENING_ONLY', 'HISTORY_APPROX');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventorySnapshotStatus" AS ENUM ('PENDING', 'VALIDATED', 'IMPORTED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extend StockLedgerTxnType enum
ALTER TYPE "StockLedgerTxnType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "StockLedgerTxnType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "StockLedgerTxnType" ADD VALUE IF NOT EXISTS 'REVERSAL';

-- Product updates
ALTER TABLE "Product" RENAME COLUMN "unit" TO "uom";
ALTER TABLE "Product" ADD COLUMN "normalizedSku" TEXT;
ALTER TABLE "Product" ADD COLUMN "title" TEXT;
ALTER TABLE "Product" ADD COLUMN "unitCostMinor" INTEGER;

UPDATE "Product"
SET "normalizedSku" = UPPER(REGEXP_REPLACE(TRIM("sku"), '\s+', ' ', 'g'))
WHERE "normalizedSku" IS NULL;

UPDATE "Product"
SET "uom" = 'pcs'
WHERE "uom" IS NULL OR "uom" = '';

ALTER TABLE "Product" ALTER COLUMN "normalizedSku" SET NOT NULL;

DROP INDEX IF EXISTS "Product_orgId_brandId_sku_key";
CREATE UNIQUE INDEX "Product_orgId_brandId_normalizedSku_key" ON "Product"("orgId", "brandId", "normalizedSku");

-- InventorySnapshot updates
ALTER TABLE "InventorySnapshot" ADD COLUMN "mode" "InventorySnapshotMode" NOT NULL DEFAULT 'OPENING_ONLY';
ALTER TABLE "InventorySnapshot" ADD COLUMN "status" "InventorySnapshotStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "InventorySnapshot" ADD COLUMN "warnings" JSONB;
ALTER TABLE "InventorySnapshot" ADD COLUMN "errors" JSONB;
ALTER TABLE "InventorySnapshot" ADD COLUMN "createdBy" TEXT;

UPDATE "InventorySnapshot"
SET "status" = 'IMPORTED'
WHERE "status" = 'PENDING';

CREATE INDEX IF NOT EXISTS "InventorySnapshot_orgId_status_idx" ON "InventorySnapshot"("orgId", "status");

-- StockBalance updates
ALTER TABLE "StockBalance" RENAME COLUMN "avgCost" TO "avgCostMinor";
ALTER TABLE "StockBalance" DROP CONSTRAINT IF EXISTS "StockBalance_pkey";
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("orgId", "itemId", "locationId");

-- StockLedger updates
ALTER TABLE "StockLedger" RENAME COLUMN "unitCost" TO "unitCostMinor";
ALTER TABLE "StockLedger" RENAME COLUMN "totalCost" TO "totalCostMinor";
ALTER TABLE "StockLedger" RENAME COLUMN "refText" TO "notes";
ALTER TABLE "StockLedger" ADD COLUMN "refInvoice" TEXT;
ALTER TABLE "StockLedger" ADD COLUMN "refChalan" TEXT;
ALTER TABLE "StockLedger" ADD COLUMN "meta" JSONB;
ALTER TABLE "StockLedger" ALTER COLUMN "txnDate" TYPE DATE USING "txnDate"::date;
