-- CreateEnum (idempotent: only create if doesn't exist)
DO $$ BEGIN
    CREATE TYPE "StockLedgerTxnType" AS ENUM ('OPENING', 'ADJUSTMENT', 'PURCHASE_IN', 'SALE_OUT', 'TRANSFER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable (idempotent: only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "Brand" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent: only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent: only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "SubCategory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent: only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "StockLocation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent: only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "InventorySnapshot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFileName" TEXT NOT NULL,
    "sourceFileHash" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add columns (brandId nullable initially, will be populated and made NOT NULL later)
-- Only add columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'brandId') THEN
        ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'description') THEN
        ALTER TABLE "Product" ADD COLUMN "description" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'ratingType') THEN
        ALTER TABLE "Product" ADD COLUMN "ratingType" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'coo') THEN
        ALTER TABLE "Product" ADD COLUMN "coo" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'categoryId') THEN
        ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'subCategoryId') THEN
        ALTER TABLE "Product" ADD COLUMN "subCategoryId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'isActive') THEN
        ALTER TABLE "Product" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- CreateTable (idempotent: only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "StockBalance" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT,
    "qtyOnHand" INTEGER NOT NULL DEFAULT 0,
    "avgCost" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent: only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "StockLedger" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT,
    "txnType" "StockLedgerTxnType" NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "totalCost" INTEGER NOT NULL DEFAULT 0,
    "refText" TEXT,
    "txnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Brand_orgId_idx" ON "Brand"("orgId");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Brand_orgId_name_key" ON "Brand"("orgId", "name");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "Category_orgId_idx" ON "Category"("orgId");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Category_orgId_name_key" ON "Category"("orgId", "name");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "SubCategory_orgId_idx" ON "SubCategory"("orgId");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "SubCategory_orgId_categoryId_name_key" ON "SubCategory"("orgId", "categoryId", "name");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "StockLocation_orgId_idx" ON "StockLocation"("orgId");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "StockLocation_orgId_code_key" ON "StockLocation"("orgId", "code");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "InventorySnapshot_orgId_importedAt_idx" ON "InventorySnapshot"("orgId", "importedAt");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "InventorySnapshot_orgId_sourceFileHash_key" ON "InventorySnapshot"("orgId", "sourceFileHash");

-- CreateIndex (non-unique indexes can be created before brandId is populated, idempotent)
CREATE INDEX IF NOT EXISTS "Product_orgId_sku_idx" ON "Product"("orgId", "sku");

-- Note: Product_orgId_brandId_idx will be created after brandId is populated

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "StockBalance_orgId_itemId_idx" ON "StockBalance"("orgId", "itemId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "StockBalance_orgId_locationId_idx" ON "StockBalance"("orgId", "locationId");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "StockBalance_orgId_itemId_locationId_key" ON "StockBalance"("orgId", "itemId", "locationId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "StockLedger_orgId_itemId_txnDate_idx" ON "StockLedger"("orgId", "itemId", "txnDate");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "StockLedger_orgId_locationId_idx" ON "StockLedger"("orgId", "locationId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "StockLedger_orgId_snapshotId_idx" ON "StockLedger"("orgId", "snapshotId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "StockLedger_orgId_txnDate_idx" ON "StockLedger"("orgId", "txnDate");

-- AddForeignKey (idempotent: only add if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubCategory_categoryId_fkey') THEN
        ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Note: Product foreign keys will be added after brandId is populated

-- AddForeignKey (idempotent: only add if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockBalance_itemId_fkey') THEN
        ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockBalance_locationId_fkey') THEN
        ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockLedger_itemId_fkey') THEN
        ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockLedger_locationId_fkey') THEN
        ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockLedger_snapshotId_fkey') THEN
        ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "InventorySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Drop old unique constraint on Product (must happen before we populate brandId)
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_orgId_sku_key";

-- Create default brand for existing products and populate brandId
DO $$
DECLARE
    default_brand_id TEXT;
    org_id_val TEXT;
BEGIN
    -- Create a default brand for each org that has products
    FOR org_id_val IN SELECT DISTINCT "orgId" FROM "Product" LOOP
        -- Insert or get existing default brand
        INSERT INTO "Brand" ("id", "orgId", "name", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::TEXT, org_id_val, 'SIEMENS', NOW(), NOW())
        ON CONFLICT ("orgId", "name") DO NOTHING
        RETURNING "id" INTO default_brand_id;
        
        -- If no brand was returned (conflict), get the existing one
        IF default_brand_id IS NULL THEN
            SELECT "id" INTO default_brand_id FROM "Brand" WHERE "orgId" = org_id_val AND "name" = 'SIEMENS' LIMIT 1;
        END IF;
        
        -- Only update if we have a valid brand ID
        IF default_brand_id IS NOT NULL THEN
            -- Update all products in this org to use the default brand (where brandId is NULL)
            UPDATE "Product"
            SET "brandId" = default_brand_id
            WHERE "orgId" = org_id_val AND "brandId" IS NULL;
        END IF;
    END LOOP;
END $$;

-- Verify all products have a brandId before making it NOT NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Product" WHERE "brandId" IS NULL) THEN
        RAISE EXCEPTION 'Cannot set brandId to NOT NULL: some products still have NULL brandId';
    END IF;
END $$;

-- Now make brandId NOT NULL since all products have been assigned a brand
ALTER TABLE "Product" ALTER COLUMN "brandId" SET NOT NULL;

-- Create indexes that depend on brandId (after it's populated and NOT NULL, idempotent)
CREATE INDEX IF NOT EXISTS "Product_orgId_brandId_idx" ON "Product"("orgId", "brandId");

-- Create new unique constraint (after brandId is populated and NOT NULL, idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Product_orgId_brandId_sku_key" ON "Product"("orgId", "brandId", "sku");

-- Add foreign key constraints for Product (idempotent: only add if doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_brandId_fkey') THEN
        ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_categoryId_fkey') THEN
        ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_subCategoryId_fkey') THEN
        ALTER TABLE "Product" ADD CONSTRAINT "Product_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
