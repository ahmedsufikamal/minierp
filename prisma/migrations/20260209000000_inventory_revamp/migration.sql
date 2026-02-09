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
-- Add id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'StockBalance' AND column_name = 'id') THEN
    ALTER TABLE "StockBalance" ADD COLUMN "id" TEXT;
    -- Generate IDs for existing rows
    UPDATE "StockBalance" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
    ALTER TABLE "StockBalance" ALTER COLUMN "id" SET NOT NULL;
  END IF;
END $$;
-- Drop old composite primary key if it exists
ALTER TABLE "StockBalance" DROP CONSTRAINT IF EXISTS "StockBalance_pkey";
-- Set id as primary key
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockBalance_pkey') THEN
    ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id");
  END IF;
END $$;
-- Create unique constraint instead of composite PK
DROP INDEX IF EXISTS "StockBalance_orgId_itemId_locationId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "StockBalance_orgId_itemId_locationId_key" ON "StockBalance"("orgId", "itemId", "locationId");

-- StockLedger updates
ALTER TABLE "StockLedger" RENAME COLUMN "unitCost" TO "unitCostMinor";
ALTER TABLE "StockLedger" RENAME COLUMN "totalCost" TO "totalCostMinor";
ALTER TABLE "StockLedger" RENAME COLUMN "refText" TO "notes";
ALTER TABLE "StockLedger" ADD COLUMN "refInvoice" TEXT;
ALTER TABLE "StockLedger" ADD COLUMN "refChalan" TEXT;
ALTER TABLE "StockLedger" ADD COLUMN "meta" JSONB;
ALTER TABLE "StockLedger" ALTER COLUMN "txnDate" TYPE DATE USING "txnDate"::date;
