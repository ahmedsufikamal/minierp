/*
  Warnings:

  - You are about to drop the column `notes` on the `InventorySnapshot` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Product_orgId_sku_idx";

-- DropIndex
DROP INDEX "Product_orgId_sku_key";

-- AlterTable
ALTER TABLE "InventorySnapshot" DROP COLUMN "notes",
ALTER COLUMN "mode" DROP DEFAULT,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "unitCostMinor" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "StockBalance" ALTER COLUMN "avgCostMinor" DROP NOT NULL,
ALTER COLUMN "avgCostMinor" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StockLedger" ALTER COLUMN "unitCostMinor" DROP NOT NULL,
ALTER COLUMN "unitCostMinor" DROP DEFAULT,
ALTER COLUMN "totalCostMinor" DROP NOT NULL,
ALTER COLUMN "totalCostMinor" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Product_orgId_normalizedSku_idx" ON "Product"("orgId", "normalizedSku");
