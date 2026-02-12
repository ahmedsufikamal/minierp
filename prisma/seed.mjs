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

    const existingRule = await prisma.inventoryReorderRule.findFirst({
      where: {
        companyId,
        itemId: product.id,
        warehouseId: warehouseMain.id,
        locationId: null,
      },
      select: { id: true },
    });

    if (existingRule) {
      await prisma.inventoryReorderRule.update({
        where: { id: existingRule.id },
        data: {
          minQty: 2,
          maxQty: 20,
          reorderPoint: 5,
          reorderQty: 10,
          leadTimeDays: 7,
        },
      });
    } else {
      await prisma.inventoryReorderRule.create({
        data: {
          companyId,
          itemId: product.id,
          warehouseId: warehouseMain.id,
          minQty: 2,
          maxQty: 20,
          reorderPoint: 5,
          reorderQty: 10,
          leadTimeDays: 7,
        },
      });
    }
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

  const permissionCatalog = [
    { key: "inventory.read", module: "inventory", description: "Read inventory entities" },
    { key: "inventory.write", module: "inventory", description: "Create/update inventory entities" },
    { key: "inventory.approve", module: "inventory", description: "Approve inventory transactions" },
    { key: "sales.read", module: "sales", description: "Read sales entities" },
    { key: "sales.write", module: "sales", description: "Write sales entities" },
    { key: "finance.read", module: "finance", description: "Read finance entities" },
    { key: "finance.write", module: "finance", description: "Write finance entities" },
    { key: "admin.members", module: "admin", description: "Manage organization members" },
    { key: "admin.roles", module: "admin", description: "Manage organization roles" },
    { key: "admin.settings", module: "admin", description: "Manage organization settings" },
    { key: "iam.audit.read", module: "iam", description: "Read IAM audit logs" },
    { key: "iam.sessions.revoke", module: "iam", description: "Revoke IAM sessions" },
    { key: "iam.impersonate", module: "iam", description: "Impersonate sessions" },
  ];

  for (const permission of permissionCatalog) {
    await prisma.iamPermission.upsert({
      where: { key: permission.key },
      create: permission,
      update: {
        module: permission.module,
        description: permission.description,
      },
    });
  }

  const allPermissions = await prisma.iamPermission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = Object.fromEntries(allPermissions.map((p) => [p.key, p.id]));

  const roleSeeds = [
    { name: "OWNER", isDefault: true, isSystem: true, permissionKeys: permissionCatalog.map((p) => p.key) },
    { name: "ADMIN", isDefault: false, isSystem: true, permissionKeys: permissionCatalog.filter((p) => p.key !== "iam.impersonate").map((p) => p.key) },
    { name: "MANAGER", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "inventory.write", "sales.read", "sales.write", "finance.read"] },
    { name: "MEMBER", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "sales.read", "finance.read"] },
    { name: "VIEWER", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "sales.read", "finance.read"] },
    { name: "AUDITOR", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "sales.read", "finance.read", "iam.audit.read"] },
  ];

  for (const roleSeed of roleSeeds) {
    const role = await prisma.iamRole.upsert({
      where: { companyId_name: { companyId, name: roleSeed.name } },
      create: {
        companyId,
        name: roleSeed.name,
        description: `${roleSeed.name} default role`,
        isSystem: roleSeed.isSystem,
        isDefault: roleSeed.isDefault,
      },
      update: {
        isSystem: roleSeed.isSystem,
        isDefault: roleSeed.isDefault,
      },
    });

    for (const key of roleSeed.permissionKeys) {
      const permissionId = permissionIdByKey[key];
      if (!permissionId) continue;
      await prisma.iamRolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }

  if (firstUser) {
    const ownerRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId, name: "OWNER" } },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: firstUser.id },
      data: {
        status: "ACTIVE",
        platformRole: "SUPER_ADMIN",
        activeCompanyId: companyId,
      },
    });

    await prisma.companyMembership.updateMany({
      where: { userId: firstUser.id, companyId },
      data: {
        role: "OWNER",
        roleId: ownerRole?.id ?? null,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      logoUrl: "https://dummyimage.com/256x256/0f172a/ffffff&text=miniERP",
      primaryColor: "214 95% 62%",
      accentColor: "220 24% 18%",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      primaryDomain: process.env.SEED_PRIMARY_DOMAIN || null,
      allowedDomains: process.env.SEED_ALLOWED_DOMAINS
        ? process.env.SEED_ALLOWED_DOMAINS.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)
        : [],
      domainVerificationStatus: process.env.SEED_PRIMARY_DOMAIN ? "VERIFIED" : "PENDING",
      allowedAuthMethods: ["PASSWORD", "MAGIC_LINK", "OAUTH_GOOGLE", "OAUTH_MICROSOFT"],
      mfaPolicy: { mode: "OPTIONAL", enforceForRoles: ["OWNER", "ADMIN"], allowOtpFallback: true },
      sessionPolicy: {
        idleTimeoutMinutes: 30,
        absoluteTimeoutMinutes: 480,
        rememberMeAbsoluteTimeoutMinutes: 43200,
        rotateEveryMinutes: 15,
      },
      botProtectionPolicy: {
        turnstileEnabled: false,
        rateLimitWindowSeconds: 60,
        rateLimitMaxAttempts: 8,
      },
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
