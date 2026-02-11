import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function defaultWorkflowConfig() {
  return {
    initialStatus: "DRAFT",
    terminalStatuses: ["POSTED", "CANCELLED", "REJECTED"],
    transitions: [
      { action: "SUBMIT", from: ["DRAFT"], to: "SUBMITTED", requiredPermissions: ["inventory.document.write"], minApprovals: 1 },
      { action: "APPROVE", from: ["SUBMITTED"], to: "APPROVED", requiredPermissions: ["inventory.document.approve"], minApprovals: 1 },
      { action: "REJECT", from: ["SUBMITTED"], to: "REJECTED", requiredPermissions: ["inventory.document.approve"], minApprovals: 1 },
      { action: "CANCEL", from: ["DRAFT", "SUBMITTED", "APPROVED"], to: "CANCELLED", requiredPermissions: ["inventory.document.write"], minApprovals: 1 },
      { action: "POST", from: ["APPROVED"], to: "POSTED", requiredPermissions: ["inventory.document.post"], minApprovals: 1 },
    ],
  };
}

async function main() {
  const companyId = process.env.SEED_COMPANY_ID || "default-org";
  const companyName = process.env.SEED_COMPANY_NAME || "Demo Company";

  await prisma.company.upsert({
    where: { id: companyId },
    create: {
      id: companyId,
      name: companyName,
      slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    },
    update: {
      name: companyName,
    },
  });

  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (firstUser) {
    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: {
          userId: firstUser.id,
          companyId,
        },
      },
      create: {
        userId: firstUser.id,
        companyId,
        role: "COMPANY_ADMIN",
        isDefault: true,
      },
      update: {
        role: "COMPANY_ADMIN",
        isDefault: true,
      },
    });
  }

  await prisma.inventoryCompanySetting.upsert({
    where: { companyId },
    create: {
      companyId,
      trackByLocation: true,
      preventNegativeStock: true,
      allowNegativeOverride: false,
      costingMethod: "AVG",
      baseCurrency: "BDT",
    },
    update: {},
  });

  const warehouseMain = await prisma.inventoryWarehouse.upsert({
    where: { companyId_code: { companyId, code: "MAIN" } },
    create: {
      companyId,
      code: "MAIN",
      name: "Main Warehouse",
      description: "Primary storage",
    },
    update: {},
  });

  const warehouseSecondary = await prisma.inventoryWarehouse.upsert({
    where: { companyId_code: { companyId, code: "RET" } },
    create: {
      companyId,
      code: "RET",
      name: "Retail Warehouse",
      description: "Retail fulfillment",
    },
    update: {},
  });

  await prisma.inventoryWarehouseLocation.upsert({
    where: {
      companyId_warehouseId_code: {
        companyId,
        warehouseId: warehouseMain.id,
        code: "A1",
      },
    },
    create: {
      companyId,
      warehouseId: warehouseMain.id,
      code: "A1",
      name: "Aisle 1",
    },
    update: {},
  });

  await prisma.inventoryWarehouseLocation.upsert({
    where: {
      companyId_warehouseId_code: {
        companyId,
        warehouseId: warehouseSecondary.id,
        code: "FLOOR",
      },
    },
    create: {
      companyId,
      warehouseId: warehouseSecondary.id,
      code: "FLOOR",
      name: "Retail Floor",
    },
    update: {},
  });

  const brand = await prisma.brand.upsert({
    where: { companyId_name: { companyId, name: "SEED-BRAND" } },
    create: { companyId, name: "SEED-BRAND" },
    update: {},
  });

  const category = await prisma.category.upsert({
    where: { companyId_name: { companyId, name: "General" } },
    create: { companyId, name: "General" },
    update: {},
  });

  const items = [
    { sku: "SEED-ITEM-001", name: "Seed Item One", unitCostMinor: 2500 },
    { sku: "SEED-ITEM-002", name: "Seed Item Two", unitCostMinor: 5500 },
  ];

  for (const item of items) {
    const product = await prisma.product.upsert({
      where: {
        companyId_brandId_normalizedSku: {
          companyId,
          brandId: brand.id,
          normalizedSku: item.sku,
        },
      },
      create: {
        companyId,
        brandId: brand.id,
        categoryId: category.id,
        sku: item.sku,
        normalizedSku: item.sku,
        name: item.name,
        title: item.name,
        uom: "pcs",
        unitCostMinor: item.unitCostMinor,
        priceCents: item.unitCostMinor,
      },
      update: {
        name: item.name,
        unitCostMinor: item.unitCostMinor,
      },
    });

    await prisma.inventoryItemIdentifier.upsert({
      where: { companyId_value: { companyId, value: item.sku } },
      create: {
        companyId,
        itemId: product.id,
        kind: "SKU",
        value: item.sku,
        isPrimary: true,
      },
      update: {
        itemId: product.id,
      },
    });

    await prisma.inventoryReorderRule.upsert({
      where: {
        companyId_itemId_warehouseId_locationId: {
          companyId,
          itemId: product.id,
          warehouseId: warehouseMain.id,
          locationId: null,
        },
      },
      create: {
        companyId,
        itemId: product.id,
        warehouseId: warehouseMain.id,
        minQty: 2,
        maxQty: 20,
        reorderPoint: 5,
        reorderQty: 10,
        leadTimeDays: 7,
      },
      update: {},
    });
  }

  const customFields = [
    {
      entityType: "ITEM",
      key: "manufacturer_part_no",
      label: "Manufacturer Part No",
      fieldType: "TEXT",
      showInList: true,
    },
    {
      entityType: "DOCUMENT",
      key: "carrier",
      label: "Carrier",
      fieldType: "TEXT",
      showInList: false,
    },
  ];

  for (const field of customFields) {
    await prisma.inventoryCustomFieldDefinition.upsert({
      where: {
        companyId_entityType_key: {
          companyId,
          entityType: field.entityType,
          key: field.key,
        },
      },
      create: {
        companyId,
        entityType: field.entityType,
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        showInList: field.showInList,
      },
      update: {
        label: field.label,
        fieldType: field.fieldType,
        showInList: field.showInList,
        isActive: true,
      },
    });
  }

  for (const type of ["ADJUSTMENT", "TRANSFER", "RECEIPT", "ISSUE", "COUNT"]) {
    const existingActive = await prisma.inventoryWorkflowDefinition.findFirst({
      where: { companyId, documentType: type, isActive: true },
      orderBy: { version: "desc" },
    });

    if (!existingActive) {
      await prisma.inventoryWorkflowDefinition.create({
        data: {
          companyId,
          documentType: type,
          name: `${type} Default Workflow`,
          version: 1,
          isActive: true,
          config: defaultWorkflowConfig(),
          createdBy: firstUser?.id ?? null,
        },
      });
    }
  }

  await prisma.inventoryLabelTemplate.upsert({
    where: { companyId_name: { companyId, name: "A4 Standard" } },
    create: {
      companyId,
      name: "A4 Standard",
      paperType: "A4",
      isDefault: true,
      config: {
        columns: 3,
        rows: 8,
        include: ["sku", "name", "barcode"],
      },
      createdBy: firstUser?.id ?? null,
    },
    update: {
      isDefault: true,
    },
  });

  console.log("Inventory seed complete", { companyId, warehouses: [warehouseMain.code, warehouseSecondary.code] });
}

main()
  .catch((error) => {
    console.error("Inventory seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
