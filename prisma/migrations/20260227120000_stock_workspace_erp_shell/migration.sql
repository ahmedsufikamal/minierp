-- Stock workspace + ERP list + settings comments support

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "assignedTo" TEXT,
  ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
  ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "variantOfId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Product_variantOfId_fkey'
      AND table_name = 'Product'
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_variantOfId_fkey"
      FOREIGN KEY ("variantOfId") REFERENCES "Product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Product_orgId_updatedAt_idx" ON "Product"("orgId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Product_orgId_assignedTo_idx" ON "Product"("orgId", "assignedTo");
CREATE INDEX IF NOT EXISTS "Product_orgId_createdBy_idx" ON "Product"("orgId", "createdBy");
CREATE INDEX IF NOT EXISTS "Product_orgId_variantOfId_idx" ON "Product"("orgId", "variantOfId");
CREATE INDEX IF NOT EXISTS "Product_orgId_isActive_isTemplate_idx" ON "Product"("orgId", "isActive", "isTemplate");

CREATE TABLE IF NOT EXISTS "InventorySettingComment" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "isEdited" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySettingComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventorySettingComment_orgId_createdAt_idx"
  ON "InventorySettingComment"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "InventorySettingComment_orgId_userId_createdAt_idx"
  ON "InventorySettingComment"("orgId", "userId", "createdAt");

CREATE TABLE IF NOT EXISTS "InventoryItemTag" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryItemTag_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'InventoryItemTag_itemId_fkey'
      AND table_name = 'InventoryItemTag'
  ) THEN
    ALTER TABLE "InventoryItemTag"
      ADD CONSTRAINT "InventoryItemTag_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItemTag_orgId_itemId_tag_key"
  ON "InventoryItemTag"("orgId", "itemId", "tag");
CREATE INDEX IF NOT EXISTS "InventoryItemTag_orgId_tag_idx"
  ON "InventoryItemTag"("orgId", "tag");
CREATE INDEX IF NOT EXISTS "InventoryItemTag_orgId_itemId_idx"
  ON "InventoryItemTag"("orgId", "itemId");
