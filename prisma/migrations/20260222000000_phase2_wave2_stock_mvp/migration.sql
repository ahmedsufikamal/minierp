-- Phase 2 Wave 2: stock MVP completion alignment (reconciliation, serial/batch baseline, reservations, immutable hooks).

DO $$ BEGIN
  CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventorySerialStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ISSUED', 'SCRAPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "trackSerial" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "trackBatch" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "InventoryReservation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "quantity" INTEGER NOT NULL,
  "fulfilledQty" INTEGER NOT NULL DEFAULT 0,
  "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "referenceType" TEXT,
  "referenceId" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "releasedAt" TIMESTAMP(3),
  "releasedBy" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryReservation_orgId_status_createdAt_idx"
  ON "InventoryReservation"("orgId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryReservation_orgId_itemId_warehouseId_locationId_idx"
  ON "InventoryReservation"("orgId", "itemId", "warehouseId", "locationId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_orgId_referenceType_referenceId_idx"
  ON "InventoryReservation"("orgId", "referenceType", "referenceId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryReservation_itemId_fkey'
      AND conrelid = '"InventoryReservation"'::regclass
  ) THEN
    ALTER TABLE "InventoryReservation"
      ADD CONSTRAINT "InventoryReservation_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryReservation_warehouseId_fkey'
      AND conrelid = '"InventoryReservation"'::regclass
  ) THEN
    ALTER TABLE "InventoryReservation"
      ADD CONSTRAINT "InventoryReservation_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryReservation_locationId_fkey'
      AND conrelid = '"InventoryReservation"'::regclass
  ) THEN
    ALTER TABLE "InventoryReservation"
      ADD CONSTRAINT "InventoryReservation_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryBatch" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "locationId" TEXT,
  "batchCode" TEXT NOT NULL,
  "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
  "manufacturedAt" DATE,
  "expiresAt" DATE,
  "metadata" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBatch_orgId_itemId_warehouseId_locationId_batchCode_key"
  ON "InventoryBatch"("orgId", "itemId", "warehouseId", "locationId", "batchCode");
CREATE INDEX IF NOT EXISTS "InventoryBatch_orgId_itemId_batchCode_idx"
  ON "InventoryBatch"("orgId", "itemId", "batchCode");
CREATE INDEX IF NOT EXISTS "InventoryBatch_orgId_warehouseId_locationId_idx"
  ON "InventoryBatch"("orgId", "warehouseId", "locationId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryBatch_itemId_fkey'
      AND conrelid = '"InventoryBatch"'::regclass
  ) THEN
    ALTER TABLE "InventoryBatch"
      ADD CONSTRAINT "InventoryBatch_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryBatch_warehouseId_fkey'
      AND conrelid = '"InventoryBatch"'::regclass
  ) THEN
    ALTER TABLE "InventoryBatch"
      ADD CONSTRAINT "InventoryBatch_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryBatch_locationId_fkey'
      AND conrelid = '"InventoryBatch"'::regclass
  ) THEN
    ALTER TABLE "InventoryBatch"
      ADD CONSTRAINT "InventoryBatch_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "InventorySerial" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "status" "InventorySerialStatus" NOT NULL DEFAULT 'AVAILABLE',
  "batchId" TEXT,
  "warehouseId" TEXT,
  "locationId" TEXT,
  "metadata" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventorySerial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventorySerial_orgId_serialNumber_key"
  ON "InventorySerial"("orgId", "serialNumber");
CREATE INDEX IF NOT EXISTS "InventorySerial_orgId_itemId_status_idx"
  ON "InventorySerial"("orgId", "itemId", "status");
CREATE INDEX IF NOT EXISTS "InventorySerial_orgId_warehouseId_locationId_idx"
  ON "InventorySerial"("orgId", "warehouseId", "locationId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventorySerial_itemId_fkey'
      AND conrelid = '"InventorySerial"'::regclass
  ) THEN
    ALTER TABLE "InventorySerial"
      ADD CONSTRAINT "InventorySerial_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventorySerial_batchId_fkey'
      AND conrelid = '"InventorySerial"'::regclass
  ) THEN
    ALTER TABLE "InventorySerial"
      ADD CONSTRAINT "InventorySerial_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventorySerial_warehouseId_fkey'
      AND conrelid = '"InventorySerial"'::regclass
  ) THEN
    ALTER TABLE "InventorySerial"
      ADD CONSTRAINT "InventorySerial_warehouseId_fkey"
      FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventorySerial_locationId_fkey'
      AND conrelid = '"InventorySerial"'::regclass
  ) THEN
    ALTER TABLE "InventorySerial"
      ADD CONSTRAINT "InventorySerial_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "InventoryWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "InventoryDocumentLine"
  ADD COLUMN IF NOT EXISTS "reservationId" TEXT,
  ADD COLUMN IF NOT EXISTS "batchCode" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumbers" JSONB;

ALTER TABLE "InventoryLedgerEntry"
  ADD COLUMN IF NOT EXISTS "reservationId" TEXT,
  ADD COLUMN IF NOT EXISTS "batchCode" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumbers" JSONB;

CREATE INDEX IF NOT EXISTS "InventoryDocumentLine_orgId_reservationId_idx"
  ON "InventoryDocumentLine"("orgId", "reservationId");
CREATE INDEX IF NOT EXISTS "InventoryDocumentLine_orgId_batchCode_idx"
  ON "InventoryDocumentLine"("orgId", "batchCode");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_reservationId_idx"
  ON "InventoryLedgerEntry"("orgId", "reservationId");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_orgId_batchCode_idx"
  ON "InventoryLedgerEntry"("orgId", "batchCode");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryDocumentLine_reservationId_fkey'
      AND conrelid = '"InventoryDocumentLine"'::regclass
  ) THEN
    ALTER TABLE "InventoryDocumentLine"
      ADD CONSTRAINT "InventoryDocumentLine_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InventoryLedgerEntry_reservationId_fkey'
      AND conrelid = '"InventoryLedgerEntry"'::regclass
  ) THEN
    ALTER TABLE "InventoryLedgerEntry"
      ADD CONSTRAINT "InventoryLedgerEntry_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
