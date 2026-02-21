-- Stock Settings ERP-grade expansion + FIFO cost layers.

DO $$
BEGIN
  CREATE TYPE "InventoryItemNamingBy" AS ENUM ('ITEM_CODE', 'NAMING_SERIES');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InventoryValuationMethod" AS ENUM ('FIFO', 'MOVING_AVERAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InventoryQiAction" AS ENUM ('STOP', 'WARN', 'ALLOW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InventorySerialBatchPickBasis" AS ENUM ('FIFO', 'LIFO', 'EXPIRY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InventoryCompanySetting"
  ADD COLUMN IF NOT EXISTS "itemNamingBy" "InventoryItemNamingBy" NOT NULL DEFAULT 'ITEM_CODE',
  ADD COLUMN IF NOT EXISTS "defaultStockUomId" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultValuationMethod" "InventoryValuationMethod" NOT NULL DEFAULT 'FIFO',
  ADD COLUMN IF NOT EXISTS "autoInsertItemPriceIfMissing" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "updateExistingPriceListRate" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "allowEditStockUomQtySalesDocs" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "allowEditStockUomQtyPurchaseDocs" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "overDeliveryReceiptAllowancePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overTransferAllowancePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overPickingAllowancePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "allowNegativeStock" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "showBarcodeFieldInStockTransactions" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "convertItemDescriptionToCleanHtml" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "allowInternalTransfersAtArmsLengthPrice" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "qiActionIfNotSubmitted" "InventoryQiAction" NOT NULL DEFAULT 'STOP',
  ADD COLUMN IF NOT EXISTS "qiActionIfRejected" "InventoryQiAction" NOT NULL DEFAULT 'STOP',
  ADD COLUMN IF NOT EXISTS "enableStockReservation" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "allowPartialReservation" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "autoReserveStockForSalesOrderOnPurchase" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "autoReserveSerialAndBatchNos" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "autoCreateSerialAndBatchBundleForOutward" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "pickSerialBatchBasedOn" "InventorySerialBatchPickBasis" NOT NULL DEFAULT 'FIFO',
  ADD COLUMN IF NOT EXISTS "disableSerialNoAndBatchSelector" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "haveDefaultNamingSeriesForBatchId" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "useSerialBatchFields" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "doNotUpdateSerialBatchOnCreationOfAutoBundle" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "allowExistingSerialNoToBeReceivedAgain" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "setBundleNamingBasedOnNamingSeries" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "raiseMaterialRequestWhenStockReachesReorderLevel" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "notifyByEmailOnCreationOfAutomaticMaterialRequest" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "allowMaterialTransferFromDeliveryNoteToSalesInvoice" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "freezeStocksOlderThanDays" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;

UPDATE "InventoryCompanySetting"
SET "allowNegativeStock" = NOT COALESCE("preventNegativeStock", TRUE);

UPDATE "InventoryCompanySetting"
SET "defaultValuationMethod" = CASE
  WHEN "costingMethod" = 'FIFO' THEN 'FIFO'::"InventoryValuationMethod"
  ELSE 'MOVING_AVERAGE'::"InventoryValuationMethod"
END;

INSERT INTO "InventoryCompanySetting" ("id", "orgId", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), c."id", NOW(), NOW()
FROM "Company" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "InventoryCompanySetting" s
  WHERE s."orgId" = c."id"
);

ALTER TABLE "InventoryCompanySetting"
  DROP CONSTRAINT IF EXISTS "InventoryCompanySetting_overDeliveryReceiptAllowancePct_chk",
  DROP CONSTRAINT IF EXISTS "InventoryCompanySetting_overTransferAllowancePct_chk",
  DROP CONSTRAINT IF EXISTS "InventoryCompanySetting_overPickingAllowancePct_chk",
  DROP CONSTRAINT IF EXISTS "InventoryCompanySetting_freezeStocksOlderThanDays_chk";

ALTER TABLE "InventoryCompanySetting"
  ADD CONSTRAINT "InventoryCompanySetting_overDeliveryReceiptAllowancePct_chk"
    CHECK ("overDeliveryReceiptAllowancePct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "InventoryCompanySetting_overTransferAllowancePct_chk"
    CHECK ("overTransferAllowancePct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "InventoryCompanySetting_overPickingAllowancePct_chk"
    CHECK ("overPickingAllowancePct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "InventoryCompanySetting_freezeStocksOlderThanDays_chk"
    CHECK ("freezeStocksOlderThanDays" >= 0);

CREATE TABLE IF NOT EXISTS "InventoryCostLayer" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "sourceDocumentId" TEXT,
  "sourceLineId" TEXT,
  "qtyRemaining" INTEGER NOT NULL,
  "unitCostMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "metadata" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryCostLayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryCostLayer_orgId_itemId_warehouseId_locationId_createdAt_id_idx"
  ON "InventoryCostLayer"("orgId", "itemId", "warehouseId", "locationId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_orgId_sourceDocumentId_idx"
  ON "InventoryCostLayer"("orgId", "sourceDocumentId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_orgId_sourceLineId_idx"
  ON "InventoryCostLayer"("orgId", "sourceLineId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_orgId_itemId_idx"
  ON "InventoryCostLayer"("orgId", "itemId");
