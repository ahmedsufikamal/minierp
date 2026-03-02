ALTER TABLE "InventoryCompanySetting"
  ADD COLUMN IF NOT EXISTS "defaultWarehouseId" TEXT,
  ADD COLUMN IF NOT EXISTS "documentSeriesCode" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultUom" TEXT NOT NULL DEFAULT 'pcs';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryCompanySetting_defaultWarehouseId_fkey'
  ) THEN
    ALTER TABLE "InventoryCompanySetting"
      ADD CONSTRAINT "InventoryCompanySetting_defaultWarehouseId_fkey"
      FOREIGN KEY ("defaultWarehouseId") REFERENCES "InventoryWarehouse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryCompanySetting_defaultWarehouseId_idx"
  ON "InventoryCompanySetting"("defaultWarehouseId");

ALTER TABLE "InventoryWarehouse"
  ADD COLUMN IF NOT EXISTS "parentWarehouseId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InventoryWarehouse_parentWarehouseId_fkey'
  ) THEN
    ALTER TABLE "InventoryWarehouse"
      ADD CONSTRAINT "InventoryWarehouse_parentWarehouseId_fkey"
      FOREIGN KEY ("parentWarehouseId") REFERENCES "InventoryWarehouse"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryWarehouse_orgId_parentWarehouseId_idx"
  ON "InventoryWarehouse"("orgId", "parentWarehouseId");
