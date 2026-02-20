-- Phase 2 Wave 2 extension: setup master data baseline + stock Item Group/UOM linkage.

CREATE TABLE IF NOT EXISTS "SetupItemGroup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "isGroup" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupItemGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupItemGroup_tenantId_orgId_name_key"
  ON "SetupItemGroup"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupItemGroup_tenantId_orgId_parentId_idx"
  ON "SetupItemGroup"("tenantId", "orgId", "parentId");

CREATE TABLE IF NOT EXISTS "SetupUom" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "symbol" TEXT,
  "mustBeWholeNumber" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupUom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupUom_tenantId_orgId_name_key"
  ON "SetupUom"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupUom_tenantId_orgId_isActive_idx"
  ON "SetupUom"("tenantId", "orgId", "isActive");

CREATE TABLE IF NOT EXISTS "SetupUomConversionFactor" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "fromUomId" TEXT NOT NULL,
  "toUomId" TEXT NOT NULL,
  "factor" DECIMAL(18,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupUomConversionFactor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupUomConversionFactor_tenantId_orgId_fromUomId_toUomId_key"
  ON "SetupUomConversionFactor"("tenantId", "orgId", "fromUomId", "toUomId");
CREATE INDEX IF NOT EXISTS "SetupUomConversionFactor_tenantId_orgId_fromUomId_idx"
  ON "SetupUomConversionFactor"("tenantId", "orgId", "fromUomId");

CREATE TABLE IF NOT EXISTS "SetupTerritory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupTerritory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupTerritory_tenantId_orgId_name_key"
  ON "SetupTerritory"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupTerritory_tenantId_orgId_parentId_idx"
  ON "SetupTerritory"("tenantId", "orgId", "parentId");

CREATE TABLE IF NOT EXISTS "SetupCustomerGroup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupCustomerGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupCustomerGroup_tenantId_orgId_name_key"
  ON "SetupCustomerGroup"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupCustomerGroup_tenantId_orgId_parentId_idx"
  ON "SetupCustomerGroup"("tenantId", "orgId", "parentId");

CREATE TABLE IF NOT EXISTS "SetupSupplierGroup" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupSupplierGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupSupplierGroup_tenantId_orgId_name_key"
  ON "SetupSupplierGroup"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupSupplierGroup_tenantId_orgId_parentId_idx"
  ON "SetupSupplierGroup"("tenantId", "orgId", "parentId");

CREATE TABLE IF NOT EXISTS "SetupBranch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupBranch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupBranch_tenantId_orgId_name_key"
  ON "SetupBranch"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupBranch_tenantId_orgId_isActive_idx"
  ON "SetupBranch"("tenantId", "orgId", "isActive");

CREATE TABLE IF NOT EXISTS "SetupDepartment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupDepartment_tenantId_orgId_name_key"
  ON "SetupDepartment"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupDepartment_tenantId_orgId_isActive_idx"
  ON "SetupDepartment"("tenantId", "orgId", "isActive");

CREATE TABLE IF NOT EXISTS "SetupDesignation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SetupDesignation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SetupDesignation_tenantId_orgId_name_key"
  ON "SetupDesignation"("tenantId", "orgId", "name");
CREATE INDEX IF NOT EXISTS "SetupDesignation_tenantId_orgId_isActive_idx"
  ON "SetupDesignation"("tenantId", "orgId", "isActive");

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "itemGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "uomId" TEXT;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "territoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "customerGroupId" TEXT;

ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "territoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "Product_orgId_itemGroupId_idx"
  ON "Product"("orgId", "itemGroupId");
CREATE INDEX IF NOT EXISTS "Product_orgId_uomId_idx"
  ON "Product"("orgId", "uomId");
CREATE INDEX IF NOT EXISTS "Customer_orgId_territoryId_idx"
  ON "Customer"("orgId", "territoryId");
CREATE INDEX IF NOT EXISTS "Customer_orgId_customerGroupId_idx"
  ON "Customer"("orgId", "customerGroupId");
CREATE INDEX IF NOT EXISTS "Vendor_orgId_territoryId_idx"
  ON "Vendor"("orgId", "territoryId");
CREATE INDEX IF NOT EXISTS "Vendor_orgId_supplierGroupId_idx"
  ON "Vendor"("orgId", "supplierGroupId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SetupItemGroup_parentId_fkey'
      AND conrelid = '"SetupItemGroup"'::regclass
  ) THEN
    ALTER TABLE "SetupItemGroup"
      ADD CONSTRAINT "SetupItemGroup_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "SetupItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SetupUomConversionFactor_fromUomId_fkey'
      AND conrelid = '"SetupUomConversionFactor"'::regclass
  ) THEN
    ALTER TABLE "SetupUomConversionFactor"
      ADD CONSTRAINT "SetupUomConversionFactor_fromUomId_fkey"
      FOREIGN KEY ("fromUomId") REFERENCES "SetupUom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SetupUomConversionFactor_toUomId_fkey'
      AND conrelid = '"SetupUomConversionFactor"'::regclass
  ) THEN
    ALTER TABLE "SetupUomConversionFactor"
      ADD CONSTRAINT "SetupUomConversionFactor_toUomId_fkey"
      FOREIGN KEY ("toUomId") REFERENCES "SetupUom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SetupTerritory_parentId_fkey'
      AND conrelid = '"SetupTerritory"'::regclass
  ) THEN
    ALTER TABLE "SetupTerritory"
      ADD CONSTRAINT "SetupTerritory_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "SetupTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SetupCustomerGroup_parentId_fkey'
      AND conrelid = '"SetupCustomerGroup"'::regclass
  ) THEN
    ALTER TABLE "SetupCustomerGroup"
      ADD CONSTRAINT "SetupCustomerGroup_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "SetupCustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SetupSupplierGroup_parentId_fkey'
      AND conrelid = '"SetupSupplierGroup"'::regclass
  ) THEN
    ALTER TABLE "SetupSupplierGroup"
      ADD CONSTRAINT "SetupSupplierGroup_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "SetupSupplierGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_itemGroupId_fkey'
      AND conrelid = '"Product"'::regclass
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_itemGroupId_fkey"
      FOREIGN KEY ("itemGroupId") REFERENCES "SetupItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Product_uomId_fkey'
      AND conrelid = '"Product"'::regclass
  ) THEN
    ALTER TABLE "Product"
      ADD CONSTRAINT "Product_uomId_fkey"
      FOREIGN KEY ("uomId") REFERENCES "SetupUom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Customer_territoryId_fkey'
      AND conrelid = '"Customer"'::regclass
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_territoryId_fkey"
      FOREIGN KEY ("territoryId") REFERENCES "SetupTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Customer_customerGroupId_fkey'
      AND conrelid = '"Customer"'::regclass
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_customerGroupId_fkey"
      FOREIGN KEY ("customerGroupId") REFERENCES "SetupCustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Vendor_territoryId_fkey'
      AND conrelid = '"Vendor"'::regclass
  ) THEN
    ALTER TABLE "Vendor"
      ADD CONSTRAINT "Vendor_territoryId_fkey"
      FOREIGN KEY ("territoryId") REFERENCES "SetupTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Vendor_supplierGroupId_fkey'
      AND conrelid = '"Vendor"'::regclass
  ) THEN
    ALTER TABLE "Vendor"
      ADD CONSTRAINT "Vendor_supplierGroupId_fkey"
      FOREIGN KEY ("supplierGroupId") REFERENCES "SetupSupplierGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
