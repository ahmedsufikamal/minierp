import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_SEED_OWNER_EMAIL = process.env.SEED_OWNER_EMAIL || "owner@demo.local";
const SYSTEM_SEED_MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL || "manager@demo.local";
const SYSTEM_SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "ChangeMe!123";
const IAM_DEMO_USERS_ENABLED =
  process.env.IAM_DEMO_USERS_ENABLED === "1" && process.env.NODE_ENV !== "production";
const IAM_DEMO_PASSWORD = process.env.IAM_DEMO_PASSWORD || "";
const DEMO_LEVEL_EMAILS = {
  level9: process.env.IAM_DEMO_LEVEL9_EMAIL || "level9.super@demo.local",
  level5: process.env.IAM_DEMO_LEVEL5_EMAIL || "level5.master@demo.local",
  level4: process.env.IAM_DEMO_LEVEL4_EMAIL || "level4.admin@demo.local",
  level3: process.env.IAM_DEMO_LEVEL3_EMAIL || "level3.general@demo.local",
  level2: process.env.IAM_DEMO_LEVEL2_EMAIL || "level2.support@demo.local",
};

const TENANT_KEY = process.env.SEED_TENANT_KEY || "demo-tenant";
const TENANT_NAME = process.env.SEED_TENANT_NAME || "Demo Tenant";

const PRIMARY_COMPANY_ID = process.env.SEED_PRIMARY_COMPANY_ID || "default-org";
const PRIMARY_COMPANY_NAME = process.env.SEED_PRIMARY_COMPANY_NAME || "Demo Company";
const SECONDARY_COMPANY_ID = process.env.SEED_SECONDARY_COMPANY_ID || "default-org-2";
const SECONDARY_COMPANY_NAME = process.env.SEED_SECONDARY_COMPANY_NAME || "Demo Trading";

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultInventoryWorkflowConfig() {
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

function defaultPlatformWorkflow() {
  return {
    initialState: "DRAFT",
    terminalStates: ["APPROVED", "REJECTED", "CANCELLED"],
    states: [
      { key: "DRAFT", label: "Draft", isInitial: true, sortOrder: 0 },
      { key: "PENDING_APPROVAL", label: "Pending Approval", sortOrder: 1 },
      { key: "APPROVED", label: "Approved", isTerminal: true, sortOrder: 2 },
      { key: "REJECTED", label: "Rejected", isTerminal: true, sortOrder: 3 },
      { key: "CANCELLED", label: "Cancelled", isTerminal: true, sortOrder: 4 },
    ],
    transitions: [
      {
        actionKey: "SUBMIT",
        fromState: "DRAFT",
        toState: "PENDING_APPROVAL",
        minApprovals: 1,
        requiredPermissions: ["platform.workflow.write"],
      },
      {
        actionKey: "APPROVE",
        fromState: "PENDING_APPROVAL",
        toState: "APPROVED",
        minApprovals: 1,
        requiredPermissions: ["platform.workflow.write"],
      },
      {
        actionKey: "REJECT",
        fromState: "PENDING_APPROVAL",
        toState: "REJECTED",
        minApprovals: 1,
        requiredPermissions: ["platform.workflow.write"],
      },
      {
        actionKey: "CANCEL",
        fromState: "DRAFT",
        toState: "CANCELLED",
        minApprovals: 1,
        requiredPermissions: ["platform.workflow.write"],
      },
    ],
  };
}

function monthStartUtc(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function monthEndUtc(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

function mapRoleToUserTypeLevel(role, platformRole = "NONE") {
  if (platformRole === "SUPER_ADMIN") return 9;
  switch ((role || "").toUpperCase()) {
    case "OWNER":
      return 5;
    case "ADMIN":
      return 4;
    case "SUPPORT":
      return 2;
    default:
      return 3;
  }
}

const permissionCatalog = [
  { key: "inventory.read", module: "inventory", description: "Read inventory entities" },
  { key: "inventory.write", module: "inventory", description: "Create/update inventory entities" },
  { key: "inventory.approve", module: "inventory", description: "Approve inventory transactions" },
  { key: "inventory.item.read", module: "inventory", description: "Read inventory items" },
  { key: "inventory.item.write", module: "inventory", description: "Create/update inventory items" },
  { key: "inventory.item.delete", module: "inventory", description: "Delete inventory items" },
  { key: "inventory.document.read", module: "inventory", description: "Read inventory documents" },
  { key: "inventory.document.write", module: "inventory", description: "Create/update inventory documents" },
  { key: "inventory.document.approve", module: "inventory", description: "Approve inventory documents" },
  { key: "inventory.document.post", module: "inventory", description: "Post inventory documents" },
  { key: "inventory.ledger.read", module: "inventory", description: "Read inventory ledger" },
  { key: "inventory.settings.read", module: "inventory", description: "Read inventory settings" },
  { key: "inventory.settings.write", module: "inventory", description: "Manage inventory settings" },
  { key: "inventory.import.read", module: "inventory", description: "Read inventory import jobs" },
  { key: "inventory.import.write", module: "inventory", description: "Create inventory imports" },
  { key: "inventory.export.read", module: "inventory", description: "Read inventory exports" },
  { key: "inventory.export.write", module: "inventory", description: "Create inventory exports" },
  { key: "inventory.attachment.read", module: "inventory", description: "Read inventory attachments" },
  { key: "inventory.attachment.write", module: "inventory", description: "Upload inventory attachments" },
  { key: "inventory.overrideNegativeStock", module: "inventory", description: "Override negative stock checks" },
  { key: "sales.read", module: "sales", description: "Read sales entities" },
  { key: "sales.write", module: "sales", description: "Write sales entities" },
  { key: "finance.read", module: "finance", description: "Read finance entities" },
  { key: "finance.write", module: "finance", description: "Write finance entities" },
  { key: "accounting.account.read", module: "accounting", description: "Read chart of accounts" },
  { key: "accounting.account.write", module: "accounting", description: "Manage chart of accounts" },
  { key: "accounting.journal.read", module: "accounting", description: "Read journal entries" },
  { key: "accounting.journal.write", module: "accounting", description: "Create draft journal entries" },
  { key: "accounting.journal.submit", module: "accounting", description: "Submit and post journal entries" },
  { key: "accounting.gl.read", module: "accounting", description: "Read general ledger entries" },
  { key: "accounting.period.read", module: "accounting", description: "Read fiscal years and periods" },
  { key: "accounting.period.write", module: "accounting", description: "Manage fiscal years and periods" },
  { key: "accounting.report.read", module: "accounting", description: "Read accounting reports" },
  { key: "admin.members", module: "admin", description: "Manage organization members" },
  { key: "admin.roles", module: "admin", description: "Manage organization roles" },
  { key: "admin.settings", module: "admin", description: "Manage organization settings" },
  { key: "iam.audit.read", module: "iam", description: "Read IAM audit logs" },
  { key: "iam.sessions.revoke", module: "iam", description: "Revoke IAM sessions" },
  { key: "iam.impersonate", module: "iam", description: "Impersonate sessions" },
  { key: "platform.tenants.read", module: "platform", description: "Read tenant and company hierarchy" },
  { key: "platform.tenants.write", module: "platform", description: "Create/update tenant and company hierarchy" },
  { key: "platform.rbac.read", module: "platform", description: "Read role profiles and scope rules" },
  { key: "platform.rbac.write", module: "platform", description: "Manage role profiles and scope rules" },
  { key: "platform.workflow.read", module: "platform", description: "Read workflow definitions and instances" },
  { key: "platform.workflow.write", module: "platform", description: "Manage workflow definitions and transitions" },
  { key: "platform.audit.read", module: "platform", description: "Read platform audit events" },
  { key: "platform.ledger.read", module: "platform", description: "Read immutable ledger events" },
  { key: "platform.numbering.read", module: "platform", description: "Read numbering series" },
  { key: "platform.numbering.write", module: "platform", description: "Manage numbering series" },
  { key: "platform.reporting.read", module: "platform", description: "Read and run reports" },
  { key: "platform.reporting.write", module: "platform", description: "Manage report definitions" },
  { key: "platform.customization.read", module: "platform", description: "Read customization metadata" },
  { key: "platform.customization.write", module: "platform", description: "Manage customization metadata" },
];

const roleSeeds = [
  { name: "OWNER", isDefault: true, isSystem: true, permissionKeys: permissionCatalog.map((item) => item.key) },
  { name: "ADMIN", isDefault: false, isSystem: true, permissionKeys: permissionCatalog.filter((item) => item.key !== "iam.impersonate").map((item) => item.key) },
  {
    name: "MANAGER",
    isDefault: false,
    isSystem: true,
    permissionKeys: [
      "inventory.read",
      "inventory.write",
      "inventory.item.read",
      "inventory.item.write",
      "inventory.document.read",
      "inventory.document.write",
      "inventory.document.approve",
      "inventory.document.post",
      "inventory.ledger.read",
      "inventory.settings.read",
      "inventory.settings.write",
      "sales.read",
      "sales.write",
      "finance.read",
      "accounting.account.read",
      "accounting.journal.read",
      "accounting.gl.read",
      "accounting.period.read",
      "accounting.report.read",
      "platform.workflow.read",
      "platform.reporting.read",
    ],
  },
  {
    name: "INVENTORY_MANAGER",
    isDefault: false,
    isSystem: true,
    permissionKeys: [
      "inventory.read",
      "inventory.write",
      "inventory.approve",
      "inventory.item.read",
      "inventory.item.write",
      "inventory.item.delete",
      "inventory.document.read",
      "inventory.document.write",
      "inventory.document.approve",
      "inventory.document.post",
      "inventory.ledger.read",
      "inventory.settings.read",
      "inventory.settings.write",
      "inventory.import.read",
      "inventory.import.write",
      "inventory.export.read",
      "inventory.export.write",
      "inventory.attachment.read",
      "inventory.attachment.write",
      "inventory.overrideNegativeStock",
    ],
  },
  { name: "SALES_MANAGER", isDefault: false, isSystem: true, permissionKeys: ["sales.read", "sales.write", "inventory.read", "inventory.item.read", "inventory.document.read", "finance.read"] },
  {
    name: "FINANCE_MANAGER",
    isDefault: false,
    isSystem: true,
    permissionKeys: [
      "finance.read",
      "finance.write",
      "accounting.account.read",
      "accounting.account.write",
      "accounting.journal.read",
      "accounting.journal.write",
      "accounting.journal.submit",
      "accounting.gl.read",
      "accounting.period.read",
      "accounting.period.write",
      "accounting.report.read",
      "sales.read",
      "inventory.read",
      "inventory.ledger.read",
      "inventory.export.read",
      "platform.reporting.read",
    ],
  },
  { name: "PROCUREMENT_MANAGER", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "inventory.write", "inventory.item.read", "inventory.item.write", "inventory.document.read", "inventory.document.write", "inventory.settings.read", "finance.read", "platform.reporting.read"] },
  {
    name: "MEMBER",
    isDefault: false,
    isSystem: true,
    permissionKeys: [
      "inventory.read",
      "inventory.item.read",
      "inventory.document.read",
      "sales.read",
      "finance.read",
      "accounting.account.read",
      "accounting.journal.read",
      "accounting.gl.read",
      "accounting.period.read",
      "accounting.report.read",
      "platform.reporting.read",
    ],
  },
  {
    name: "VIEWER",
    isDefault: false,
    isSystem: true,
    permissionKeys: [
      "inventory.read",
      "inventory.item.read",
      "inventory.document.read",
      "inventory.ledger.read",
      "sales.read",
      "finance.read",
      "accounting.account.read",
      "accounting.journal.read",
      "accounting.gl.read",
      "accounting.period.read",
      "accounting.report.read",
      "platform.reporting.read",
    ],
  },
  { name: "AUDITOR", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "inventory.item.read", "inventory.document.read", "inventory.ledger.read", "inventory.export.read", "sales.read", "finance.read", "iam.audit.read", "platform.audit.read", "platform.ledger.read", "platform.reporting.read"] },
];

async function ensurePermissionCatalog() {
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
}

async function ensureRoleCatalog(companyId) {
  const allPermissions = await prisma.iamPermission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = Object.fromEntries(allPermissions.map((item) => [item.key, item.id]));

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
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }
}

async function ensureUser(email, name, role, companyId, platformRole = "NONE", password = SYSTEM_SEED_PASSWORD) {
  const passwordHash = await bcrypt.hash(password, 10);
  const normalizedEmail = email.trim().toLowerCase();

  return prisma.user.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      name,
      role,
      companyId,
      activeCompanyId: companyId,
      passwordHash,
      status: "ACTIVE",
      platformRole,
      emailVerifiedAt: new Date(),
    },
    update: {
      name,
      role,
      companyId,
      activeCompanyId: companyId,
      status: "ACTIVE",
      platformRole,
      emailVerifiedAt: new Date(),
    },
  });
}

async function ensureCompanyBase({ companyId, companyName, tenantId, primaryDomain = null, createdByUserId }) {
  const company = await prisma.company.upsert({
    where: { id: companyId },
    create: {
      id: companyId,
      tenantId,
      name: companyName,
      slug: slugify(companyName),
      primaryDomain,
      domainVerificationStatus: primaryDomain ? "VERIFIED" : "PENDING",
    },
    update: {
      tenantId,
      name: companyName,
      primaryDomain,
      domainVerificationStatus: primaryDomain ? "VERIFIED" : "PENDING",
    },
  });

  await prisma.inventoryCompanySetting.upsert({
    where: { companyId },
    create: {
      companyId,
      itemNamingBy: "ITEM_CODE",
      defaultValuationMethod: "FIFO",
      allowNegativeStock: false,
      trackByLocation: true,
      preventNegativeStock: true,
      allowNegativeOverride: false,
      costingMethod: "AVG",
      enableStockReservation: true,
      allowPartialReservation: false,
      autoCreateSerialAndBatchBundleForOutward: true,
      pickSerialBatchBasedOn: "FIFO",
      raiseMaterialRequestWhenStockReachesReorderLevel: true,
      freezeStocksOlderThanDays: 60,
      version: 1,
      baseCurrency: "USD",
    },
    update: {
      itemNamingBy: "ITEM_CODE",
      defaultValuationMethod: "FIFO",
      allowNegativeStock: false,
      trackByLocation: true,
      preventNegativeStock: true,
      allowNegativeOverride: false,
      costingMethod: "AVG",
      enableStockReservation: true,
      allowPartialReservation: false,
      autoCreateSerialAndBatchBundleForOutward: true,
      pickSerialBatchBasedOn: "FIFO",
      raiseMaterialRequestWhenStockReachesReorderLevel: true,
      freezeStocksOlderThanDays: 60,
      version: 1,
      baseCurrency: "USD",
    },
  });

  const warehouseMain = await prisma.inventoryWarehouse.upsert({
    where: { companyId_code: { companyId, code: "MAIN" } },
    create: {
      companyId,
      code: "MAIN",
      name: `${companyName} Main Warehouse`,
      description: "Primary storage",
    },
    update: {
      name: `${companyName} Main Warehouse`,
    },
  });

  const warehouseRetail = await prisma.inventoryWarehouse.upsert({
    where: { companyId_code: { companyId, code: "RET" } },
    create: {
      companyId,
      code: "RET",
      name: `${companyName} Retail Warehouse`,
      description: "Retail fulfillment",
    },
    update: {
      name: `${companyName} Retail Warehouse`,
    },
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
    update: {
      name: "Aisle 1",
    },
  });

  await prisma.inventoryWarehouseLocation.upsert({
    where: {
      companyId_warehouseId_code: {
        companyId,
        warehouseId: warehouseRetail.id,
        code: "FLOOR",
      },
    },
    create: {
      companyId,
      warehouseId: warehouseRetail.id,
      code: "FLOOR",
      name: "Retail Floor",
    },
    update: {
      name: "Retail Floor",
    },
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
    { sku: `${slugify(companyName).toUpperCase()}-ITEM-001`, name: `${companyName} Item One`, unitCostMinor: 2500 },
    { sku: `${slugify(companyName).toUpperCase()}-ITEM-002`, name: `${companyName} Item Two`, unitCostMinor: 5500 },
  ];

  const seededProducts = [];

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
        priceCents: item.unitCostMinor,
      },
    });

    seededProducts.push(product);

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

  const inventoryCustomFields = [
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

  for (const field of inventoryCustomFields) {
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
          config: defaultInventoryWorkflowConfig(),
          createdBy: createdByUserId ?? null,
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
      createdBy: createdByUserId ?? null,
    },
    update: {
      isDefault: true,
    },
  });

  const now = new Date();
  const fiscalYearNumber = now.getUTCFullYear();
  const fiscalYearName = `FY${fiscalYearNumber}`;
  const fiscalYearStart = new Date(Date.UTC(fiscalYearNumber, 0, 1));
  const fiscalYearEnd = new Date(Date.UTC(fiscalYearNumber, 11, 31));

  const fiscalYear = await prisma.fiscalYear.upsert({
    where: {
      tenantId_companyId_name: {
        tenantId,
        companyId,
        name: fiscalYearName,
      },
    },
    create: {
      tenantId,
      companyId,
      name: fiscalYearName,
      startDate: fiscalYearStart,
      endDate: fiscalYearEnd,
      isClosed: false,
      isDefault: true,
      createdBy: createdByUserId ?? null,
    },
    update: {
      startDate: fiscalYearStart,
      endDate: fiscalYearEnd,
      isClosed: false,
      isDefault: true,
    },
  });

  for (let month = 0; month < 12; month += 1) {
    const periodName = `${fiscalYearName}-${String(month + 1).padStart(2, "0")}`;
    await prisma.accountingPeriod.upsert({
      where: {
        tenantId_companyId_fiscalYearId_name: {
          tenantId,
          companyId,
          fiscalYearId: fiscalYear.id,
          name: periodName,
        },
      },
      create: {
        tenantId,
        companyId,
        fiscalYearId: fiscalYear.id,
        name: periodName,
        startDate: monthStartUtc(fiscalYearNumber, month),
        endDate: monthEndUtc(fiscalYearNumber, month),
        status: "OPEN",
        isYearEnd: month === 11,
      },
      update: {
        startDate: monthStartUtc(fiscalYearNumber, month),
        endDate: monthEndUtc(fiscalYearNumber, month),
        status: "OPEN",
        isYearEnd: month === 11,
      },
    });
  }

  const accountCatalog = [
    { code: "1000", name: "Assets", type: "ASSET", rootType: "ASSET", isGroup: true, parentCode: null },
    { code: "1100", name: "Cash", type: "ASSET", rootType: "ASSET", isGroup: false, parentCode: "1000" },
    { code: "2000", name: "Liabilities", type: "LIABILITY", rootType: "LIABILITY", isGroup: true, parentCode: null },
    { code: "2100", name: "Accounts Payable", type: "LIABILITY", rootType: "LIABILITY", isGroup: false, parentCode: "2000" },
    { code: "3000", name: "Equity", type: "EQUITY", rootType: "EQUITY", isGroup: true, parentCode: null },
    { code: "3100", name: "Retained Earnings", type: "EQUITY", rootType: "EQUITY", isGroup: false, parentCode: "3000" },
    { code: "4000", name: "Income", type: "INCOME", rootType: "INCOME", isGroup: true, parentCode: null },
    { code: "4100", name: "Sales", type: "INCOME", rootType: "INCOME", isGroup: false, parentCode: "4000" },
    { code: "5000", name: "Expenses", type: "EXPENSE", rootType: "EXPENSE", isGroup: true, parentCode: null },
    { code: "5100", name: "Cost of Goods Sold", type: "EXPENSE", rootType: "EXPENSE", isGroup: false, parentCode: "5000" },
  ];

  const accountByCode = new Map();
  for (const row of accountCatalog) {
    const account = await prisma.account.upsert({
      where: {
        companyId_code: {
          companyId,
          code: row.code,
        },
      },
      create: {
        companyId,
        tenantId,
        code: row.code,
        name: row.name,
        type: row.type,
        rootType: row.rootType,
        isGroup: row.isGroup,
      },
      update: {
        tenantId,
        name: row.name,
        type: row.type,
        rootType: row.rootType,
        isGroup: row.isGroup,
      },
    });
    accountByCode.set(row.code, account);
  }

  for (const row of accountCatalog) {
    if (!row.parentCode) continue;
    const account = accountByCode.get(row.code);
    const parent = accountByCode.get(row.parentCode);
    if (!account || !parent) continue;
    await prisma.account.update({
      where: { id: account.id },
      data: { parentId: parent.id },
    });
  }

  const currentPeriod = await prisma.accountingPeriod.findFirst({
    where: {
      tenantId,
      companyId,
      fiscalYearId: fiscalYear.id,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { id: true },
  });

  const openingEntry = await prisma.journalEntry.upsert({
    where: {
      companyId_number: {
        companyId,
        number: `JE-${companyId}-0001`,
      },
    },
    create: {
      tenantId,
      companyId,
      number: `JE-${companyId}-0001`,
      status: "SUBMITTED",
      date: now,
      postingDate: now,
      fiscalYearId: fiscalYear.id,
      accountingPeriodId: currentPeriod?.id ?? null,
      memo: `Seed opening journal for ${companyName}`,
      submittedAt: now,
      submittedBy: createdByUserId ?? null,
      postedAt: now,
      postedBy: createdByUserId ?? null,
      totalDebitCents: 100000,
      totalCreditCents: 100000,
    },
    update: {
      tenantId,
      status: "SUBMITTED",
      date: now,
      postingDate: now,
      fiscalYearId: fiscalYear.id,
      accountingPeriodId: currentPeriod?.id ?? null,
      memo: `Seed opening journal for ${companyName}`,
      submittedAt: now,
      submittedBy: createdByUserId ?? null,
      postedAt: now,
      postedBy: createdByUserId ?? null,
      totalDebitCents: 100000,
      totalCreditCents: 100000,
    },
  });

  await prisma.journalLine.deleteMany({ where: { entryId: openingEntry.id } });
  const cash = accountByCode.get("1100");
  const equity = accountByCode.get("3100");
  if (cash && equity) {
    await prisma.journalLine.createMany({
      data: [
        {
          entryId: openingEntry.id,
          lineNo: 1,
          accountId: cash.id,
          description: "Opening cash balance",
          debitCents: 100000,
          creditCents: 0,
        },
        {
          entryId: openingEntry.id,
          lineNo: 2,
          accountId: equity.id,
          description: "Opening equity",
          debitCents: 0,
          creditCents: 100000,
        },
      ],
    });

    await prisma.gLEntry.deleteMany({ where: { journalEntryId: openingEntry.id } });
    await prisma.gLEntry.createMany({
      data: [
        {
          tenantId,
          companyId,
          postingDate: now,
          accountId: cash.id,
          journalEntryId: openingEntry.id,
          fiscalYearId: fiscalYear.id,
          accountingPeriodId: currentPeriod?.id ?? null,
          debitCents: 100000,
          creditCents: 0,
          currency: "USD",
          voucherType: "JOURNAL_ENTRY",
          voucherId: openingEntry.id,
          remarks: openingEntry.memo,
          createdBy: createdByUserId ?? null,
        },
        {
          tenantId,
          companyId,
          postingDate: now,
          accountId: equity.id,
          journalEntryId: openingEntry.id,
          fiscalYearId: fiscalYear.id,
          accountingPeriodId: currentPeriod?.id ?? null,
          debitCents: 0,
          creditCents: 100000,
          currency: "USD",
          voucherType: "JOURNAL_ENTRY",
          voucherId: openingEntry.id,
          remarks: openingEntry.memo,
          createdBy: createdByUserId ?? null,
        },
      ],
    });
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      logoUrl: "https://dummyimage.com/256x256/0f172a/ffffff&text=miniERP",
      primaryColor: "214 95% 62%",
      accentColor: "220 24% 18%",
      fontFamily: "Inter, ui-sans-serif, system-ui",
      allowedDomains: [],
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

  // Basic commercial demo data to support report and module test fixtures.
  const customer = await prisma.customer.upsert({
    where: {
      id: `${companyId}-customer-1`,
    },
    create: {
      id: `${companyId}-customer-1`,
      companyId,
      name: `${companyName} Customer`,
      email: `sales+${slugify(companyName)}@demo.local`,
    },
    update: {
      name: `${companyName} Customer`,
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: {
      id: `${companyId}-vendor-1`,
    },
    create: {
      id: `${companyId}-vendor-1`,
      companyId,
      name: `${companyName} Supplier`,
      email: `buying+${slugify(companyName)}@demo.local`,
    },
    update: {
      name: `${companyName} Supplier`,
    },
  });

  const invoice = await prisma.salesInvoice.upsert({
    where: {
      companyId_number: {
        companyId,
        number: `SINV-${companyId}-0001`,
      },
    },
    create: {
      companyId,
      number: `SINV-${companyId}-0001`,
      status: "SENT",
      customerId: customer.id,
      invoiceDate: new Date(),
      lines: {
        create: [
          {
            description: seededProducts[0]?.name || "Seed item",
            qty: 1,
            unitPriceCents: seededProducts[0]?.priceCents || 2500,
            productId: seededProducts[0]?.id || null,
          },
        ],
      },
    },
    update: {},
  });

  await prisma.purchaseBill.upsert({
    where: {
      companyId_number: {
        companyId,
        number: `PINV-${companyId}-0001`,
      },
    },
    create: {
      companyId,
      number: `PINV-${companyId}-0001`,
      status: "RECEIVED",
      vendorId: vendor.id,
      billDate: new Date(),
      lines: {
        create: [
          {
            description: seededProducts[1]?.name || "Seed item",
            qty: 1,
            unitPriceCents: seededProducts[1]?.priceCents || 5500,
            productId: seededProducts[1]?.id || null,
          },
        ],
      },
    },
    update: {},
  });

  return {
    company,
    warehouseMain,
    seededProducts,
    invoice,
  };
}

async function main() {
  await ensurePermissionCatalog();

  const tenant = await prisma.tenant.upsert({
    where: { key: TENANT_KEY },
    create: {
      key: TENANT_KEY,
      name: TENANT_NAME,
      status: "ACTIVE",
      plan: "community",
      settings: {
        timezone: "UTC",
        baseCurrency: "USD",
      },
    },
    update: {
      name: TENANT_NAME,
      status: "ACTIVE",
      plan: "community",
    },
  });

  const ownerUser = await ensureUser(SYSTEM_SEED_OWNER_EMAIL, "Demo Owner", "OWNER", PRIMARY_COMPANY_ID, "SUPER_ADMIN");
  const managerUser = await ensureUser(SYSTEM_SEED_MANAGER_EMAIL, "Demo Manager", "MANAGER", PRIMARY_COMPANY_ID, "NONE");

  const primaryCompany = await ensureCompanyBase({
    companyId: PRIMARY_COMPANY_ID,
    companyName: PRIMARY_COMPANY_NAME,
    tenantId: tenant.id,
    primaryDomain: process.env.SEED_PRIMARY_DOMAIN || null,
    createdByUserId: ownerUser.id,
  });

  const secondaryCompany = await ensureCompanyBase({
    companyId: SECONDARY_COMPANY_ID,
    companyName: SECONDARY_COMPANY_NAME,
    tenantId: tenant.id,
    primaryDomain: process.env.SEED_SECONDARY_DOMAIN || null,
    createdByUserId: ownerUser.id,
  });

  if (process.env.SEED_PRIMARY_DOMAIN) {
    await prisma.tenantDomain.upsert({
      where: { domain: process.env.SEED_PRIMARY_DOMAIN.trim().toLowerCase() },
      create: {
        tenantId: tenant.id,
        domain: process.env.SEED_PRIMARY_DOMAIN.trim().toLowerCase(),
        isPrimary: true,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
      update: {
        tenantId: tenant.id,
        isPrimary: true,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
  }

  for (const companyId of [primaryCompany.company.id, secondaryCompany.company.id]) {
    await ensureRoleCatalog(companyId);
  }

  const ownerRoleByCompany = new Map();
  const managerRoleByCompany = new Map();
  const adminRoleByCompany = new Map();
  const memberRoleByCompany = new Map();

  for (const companyId of [primaryCompany.company.id, secondaryCompany.company.id]) {
    const ownerRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId, name: "OWNER" } },
      select: { id: true },
    });
    const managerRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId, name: "MANAGER" } },
      select: { id: true },
    });
    const adminRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId, name: "ADMIN" } },
      select: { id: true },
    });
    const memberRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId, name: "MEMBER" } },
      select: { id: true },
    });

    ownerRoleByCompany.set(companyId, ownerRole?.id || null);
    managerRoleByCompany.set(companyId, managerRole?.id || null);
    adminRoleByCompany.set(companyId, adminRole?.id || null);
    memberRoleByCompany.set(companyId, memberRole?.id || null);
  }

  for (const companyId of [primaryCompany.company.id, secondaryCompany.company.id]) {
    const ownerRoleId = ownerRoleByCompany.get(companyId);
    const managerRoleId = managerRoleByCompany.get(companyId);
    const activeOwner = await prisma.companyMembership.findFirst({
      where: {
        companyId,
        role: "OWNER",
        status: "ACTIVE",
      },
      select: { userId: true },
    });
    const effectiveOwnerUserId = activeOwner?.userId ?? ownerUser.id;

    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: {
          userId: effectiveOwnerUserId,
          companyId,
        },
      },
      create: {
        userId: effectiveOwnerUserId,
        companyId,
        role: "OWNER",
        roleId: ownerRoleId,
        userTypeLevel: mapRoleToUserTypeLevel(
          "OWNER",
          effectiveOwnerUserId === ownerUser.id ? "SUPER_ADMIN" : "NONE",
        ),
        userTypeLabel: effectiveOwnerUserId === ownerUser.id ? "SUPER_USER" : "MASTER_USER",
        status: "ACTIVE",
        isDefault: companyId === PRIMARY_COMPANY_ID,
        joinedAt: new Date(),
      },
      update: {
        role: "OWNER",
        roleId: ownerRoleId,
        userTypeLevel: mapRoleToUserTypeLevel(
          "OWNER",
          effectiveOwnerUserId === ownerUser.id ? "SUPER_ADMIN" : "NONE",
        ),
        userTypeLabel: effectiveOwnerUserId === ownerUser.id ? "SUPER_USER" : "MASTER_USER",
        status: "ACTIVE",
        isDefault: companyId === PRIMARY_COMPANY_ID,
      },
    });

    if (ownerUser.id !== effectiveOwnerUserId) {
      await prisma.companyMembership.upsert({
        where: {
          userId_companyId: {
            userId: ownerUser.id,
            companyId,
          },
        },
        create: {
          userId: ownerUser.id,
          companyId,
          role: "MANAGER",
          roleId: managerRoleId,
          userTypeLevel: mapRoleToUserTypeLevel("MANAGER", "SUPER_ADMIN"),
          userTypeLabel: "SUPER_USER",
          status: "ACTIVE",
          isDefault: false,
          joinedAt: new Date(),
        },
        update: {
          role: "MANAGER",
          roleId: managerRoleId,
          userTypeLevel: mapRoleToUserTypeLevel("MANAGER", "SUPER_ADMIN"),
          userTypeLabel: "SUPER_USER",
          status: "ACTIVE",
          isDefault: false,
        },
      });
    }

    if (managerUser.id !== effectiveOwnerUserId) {
      await prisma.companyMembership.upsert({
        where: {
          userId_companyId: {
            userId: managerUser.id,
            companyId,
          },
        },
        create: {
          userId: managerUser.id,
          companyId,
          role: "MANAGER",
          roleId: managerRoleId,
          userTypeLevel: mapRoleToUserTypeLevel("MANAGER"),
          userTypeLabel: "GENERAL_USER",
          status: "ACTIVE",
          isDefault: companyId === PRIMARY_COMPANY_ID,
          joinedAt: new Date(),
        },
        update: {
          role: "MANAGER",
          roleId: managerRoleId,
          userTypeLevel: mapRoleToUserTypeLevel("MANAGER"),
          userTypeLabel: "GENERAL_USER",
          status: "ACTIVE",
          isDefault: companyId === PRIMARY_COMPANY_ID,
        },
      });
    }
  }

  await prisma.user.update({
    where: { id: ownerUser.id },
    data: {
      activeCompanyId: PRIMARY_COMPANY_ID,
      companyId: PRIMARY_COMPANY_ID,
      status: "ACTIVE",
      platformRole: "SUPER_ADMIN",
    },
  });

  await prisma.user.update({
    where: { id: managerUser.id },
    data: {
      activeCompanyId: PRIMARY_COMPANY_ID,
      companyId: PRIMARY_COMPANY_ID,
      status: "ACTIVE",
      platformRole: "NONE",
    },
  });

  if (IAM_DEMO_USERS_ENABLED) {
    if (!IAM_DEMO_PASSWORD) {
      throw new Error("IAM_DEMO_PASSWORD is required when IAM_DEMO_USERS_ENABLED=1");
    }

    const demoUsers = [
      {
        level: 9,
        email: DEMO_LEVEL_EMAILS.level9,
        name: "Demo Level 9 Super User",
        role: "ADMIN",
        platformRole: "SUPER_ADMIN",
      },
      {
        level: 5,
        email: DEMO_LEVEL_EMAILS.level5,
        name: "Demo Level 5 Master User",
        role: "ADMIN",
        platformRole: "NONE",
      },
      {
        level: 4,
        email: DEMO_LEVEL_EMAILS.level4,
        name: "Demo Level 4 Administrator User",
        role: "ADMIN",
        platformRole: "NONE",
      },
      {
        level: 3,
        email: DEMO_LEVEL_EMAILS.level3,
        name: "Demo Level 3 General User",
        role: "MEMBER",
        platformRole: "NONE",
      },
      {
        level: 2,
        email: DEMO_LEVEL_EMAILS.level2,
        name: "Demo Level 2 Support User",
        role: "MEMBER",
        platformRole: "SUPPORT",
      },
    ];

    for (const demoUser of demoUsers) {
      const user = await ensureUser(
        demoUser.email,
        demoUser.name,
        demoUser.role,
        PRIMARY_COMPANY_ID,
        demoUser.platformRole,
        IAM_DEMO_PASSWORD,
      );

      await prisma.user.update({
        where: { id: user.id },
        data: {
          activeCompanyId: PRIMARY_COMPANY_ID,
          companyId: PRIMARY_COMPANY_ID,
          status: "ACTIVE",
          platformRole: demoUser.platformRole,
        },
      });

      for (const companyId of [PRIMARY_COMPANY_ID, SECONDARY_COMPANY_ID]) {
        const roleId =
          demoUser.role === "ADMIN"
            ? adminRoleByCompany.get(companyId)
            : memberRoleByCompany.get(companyId);

        await prisma.companyMembership.upsert({
          where: {
            userId_companyId: {
              userId: user.id,
              companyId,
            },
          },
          create: {
            userId: user.id,
            companyId,
            role: demoUser.role,
            roleId: roleId ?? null,
            userTypeLevel: demoUser.level,
            userTypeLabel:
              demoUser.level === 9
                ? "SUPER_USER"
                : demoUser.level === 5
                  ? "MASTER_USER"
                  : demoUser.level === 4
                    ? "ADMINISTRATOR_USER"
                    : demoUser.level === 2
                      ? "SUPPORT_USER"
                      : "GENERAL_USER",
            status: "ACTIVE",
            isDefault: companyId === PRIMARY_COMPANY_ID,
            joinedAt: new Date(),
          },
          update: {
            role: demoUser.role,
            roleId: roleId ?? null,
            userTypeLevel: demoUser.level,
            userTypeLabel:
              demoUser.level === 9
                ? "SUPER_USER"
                : demoUser.level === 5
                  ? "MASTER_USER"
                  : demoUser.level === 4
                    ? "ADMINISTRATOR_USER"
                    : demoUser.level === 2
                      ? "SUPPORT_USER"
                      : "GENERAL_USER",
            status: "ACTIVE",
            isDefault: companyId === PRIMARY_COMPANY_ID,
          },
        });
      }
    }
  }

  const roleProfile = await prisma.roleProfile.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: "OPS_MANAGER",
      },
    },
    create: {
      tenantId: tenant.id,
      name: "OPS_MANAGER",
      description: "Operations role profile scoped to warehouse MAIN",
      isDefault: false,
    },
    update: {
      description: "Operations role profile scoped to warehouse MAIN",
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: ownerUser.id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: ownerUser.id,
      role: "OWNER",
      roleProfileId: roleProfile.id,
      status: "ACTIVE",
      isDefault: true,
      joinedAt: new Date(),
    },
    update: {
      role: "OWNER",
      roleProfileId: roleProfile.id,
      status: "ACTIVE",
      isDefault: true,
      joinedAt: new Date(),
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: managerUser.id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: managerUser.id,
      role: "MANAGER",
      roleProfileId: roleProfile.id,
      status: "ACTIVE",
      isDefault: false,
      joinedAt: new Date(),
    },
    update: {
      role: "MANAGER",
      roleProfileId: roleProfile.id,
      status: "ACTIVE",
    },
  });

  await prisma.permissionRule.upsert({
    where: {
      roleProfileId_module_resource_action_scopeLevel: {
        roleProfileId: roleProfile.id,
        module: "inventory",
        resource: "document",
        action: "write",
        scopeLevel: "COMPANY",
      },
    },
    create: {
      tenantId: tenant.id,
      roleProfileId: roleProfile.id,
      module: "inventory",
      resource: "document",
      action: "write",
      effect: "ALLOW",
      scopeLevel: "COMPANY",
      condition: null,
    },
    update: {
      effect: "ALLOW",
      condition: null,
    },
  });

  await prisma.rowScopeRule.create({
    data: {
      tenantId: tenant.id,
      roleProfileId: roleProfile.id,
      resource: "inventory.document",
      scopeLevel: "WAREHOUSE",
      selector: {
        warehouseIds: [primaryCompany.warehouseMain.id],
      },
    },
  }).catch(() => {
    // Row scope rule is additive; ignore duplicate errors from repeated seeds.
  });

  const workflowTemplate = defaultPlatformWorkflow();
  const existingWorkflow = await prisma.workflowDefinition.findFirst({
    where: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      entityType: "inventory.document.transfer",
      status: "ACTIVE",
    },
    orderBy: { version: "desc" },
  });

  if (!existingWorkflow) {
    await prisma.workflowDefinition.create({
      data: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        entityType: "inventory.document.transfer",
        name: "Inventory Transfer Approval",
        version: 1,
        status: "ACTIVE",
        initialState: workflowTemplate.initialState,
        terminalStates: workflowTemplate.terminalStates,
        config: {
          description: "Seeded generic workflow for Phase 1 scaffold",
        },
        createdBy: ownerUser.id,
        updatedBy: ownerUser.id,
        states: {
          create: workflowTemplate.states,
        },
        transitions: {
          create: workflowTemplate.transitions,
        },
      },
    });
  }

  await prisma.numberSeries.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "SINV",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "SINV",
      name: "Sales Invoice Series",
      pattern: "SINV-{FY}-{COMP}-{####}",
      resetPolicy: "FISCAL_YEAR",
      startAt: 1,
      padding: 4,
      isActive: true,
    },
    update: {
      name: "Sales Invoice Series",
      pattern: "SINV-{FY}-{COMP}-{####}",
      resetPolicy: "FISCAL_YEAR",
      startAt: 1,
      padding: 4,
      isActive: true,
    },
  });

  await prisma.numberSeries.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "JE",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "JE",
      name: "Journal Entry Series",
      pattern: "JE-{FY}-{COMP}-{####}",
      resetPolicy: "FISCAL_YEAR",
      startAt: 1,
      padding: 4,
      isActive: true,
    },
    update: {
      name: "Journal Entry Series",
      pattern: "JE-{FY}-{COMP}-{####}",
      resetPolicy: "FISCAL_YEAR",
      startAt: 1,
      padding: 4,
      isActive: true,
    },
  });

  await prisma.numberSeries.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "PINV",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "PINV",
      name: "Purchase Invoice Series",
      pattern: "PINV-{FY}-{COMP}-{####}",
      resetPolicy: "FISCAL_YEAR",
      startAt: 1,
      padding: 4,
      isActive: true,
    },
    update: {
      name: "Purchase Invoice Series",
      pattern: "PINV-{FY}-{COMP}-{####}",
      resetPolicy: "FISCAL_YEAR",
      startAt: 1,
      padding: 4,
      isActive: true,
    },
  });

  await prisma.reportDefinition.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "sales_invoice_register",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "sales_invoice_register",
      name: "Sales Invoice Register",
      sourceType: "ADAPTER",
      sourceRef: "sales.invoices",
      isSystem: true,
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
    update: {
      name: "Sales Invoice Register",
      sourceType: "ADAPTER",
      sourceRef: "sales.invoices",
      isSystem: true,
      isActive: true,
      updatedBy: ownerUser.id,
    },
  });

  await prisma.reportDefinition.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "accounting_trial_balance",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "accounting_trial_balance",
      name: "Trial Balance",
      sourceType: "ADAPTER",
      sourceRef: "accounting.trial-balance",
      isSystem: true,
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
    update: {
      name: "Trial Balance",
      sourceType: "ADAPTER",
      sourceRef: "accounting.trial-balance",
      isSystem: true,
      isActive: true,
      updatedBy: ownerUser.id,
    },
  });

  await prisma.reportDefinition.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "accounting_profit_loss",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "accounting_profit_loss",
      name: "Profit and Loss",
      sourceType: "ADAPTER",
      sourceRef: "accounting.profit-loss",
      isSystem: true,
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
    update: {
      name: "Profit and Loss",
      sourceType: "ADAPTER",
      sourceRef: "accounting.profit-loss",
      isSystem: true,
      isActive: true,
      updatedBy: ownerUser.id,
    },
  });

  await prisma.reportDefinition.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "accounting_balance_sheet",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "accounting_balance_sheet",
      name: "Balance Sheet",
      sourceType: "ADAPTER",
      sourceRef: "accounting.balance-sheet",
      isSystem: true,
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
    update: {
      name: "Balance Sheet",
      sourceType: "ADAPTER",
      sourceRef: "accounting.balance-sheet",
      isSystem: true,
      isActive: true,
      updatedBy: ownerUser.id,
    },
  });

  await prisma.reportDefinition.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        key: "platform_audit_feed",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      key: "platform_audit_feed",
      name: "Platform Audit Feed",
      sourceType: "ADAPTER",
      sourceRef: "platform.audit",
      isSystem: true,
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
    update: {
      name: "Platform Audit Feed",
      sourceType: "ADAPTER",
      sourceRef: "platform.audit",
      isSystem: true,
      isActive: true,
      updatedBy: ownerUser.id,
    },
  });

  await prisma.customField.upsert({
    where: {
      tenantId_companyId_entityType_fieldKey: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        entityType: "sales_invoice",
        fieldKey: "customer_reference",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      entityType: "sales_invoice",
      fieldKey: "customer_reference",
      label: "Customer Reference",
      dataType: "TEXT",
      required: false,
      unique: false,
      showInList: true,
      readOnly: false,
      isHidden: false,
      sortOrder: 10,
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
    update: {
      label: "Customer Reference",
      dataType: "TEXT",
      showInList: true,
      isActive: true,
      updatedBy: ownerUser.id,
    },
  });

  await prisma.formLayout.create({
    data: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      entityType: "sales_invoice",
      name: "Default Sales Invoice Layout",
      version: 1,
      isDefault: true,
      isActive: true,
      layout: {
        sections: [
          {
            title: "Main",
            columns: [
              ["customer", "invoiceDate", "dueDate"],
              ["customer_reference", "status"],
            ],
          },
          {
            title: "Items",
            columns: [["lines"]],
          },
        ],
      },
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
  }).catch(() => {
    // Repeated seeds may keep this layout.
  });

  await prisma.validationRule.create({
    data: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      entityType: "sales_invoice",
      name: "Require customer on submit",
      trigger: "on_submit",
      ruleType: "required",
      expression: "customerId != null",
      config: {
        field: "customerId",
      },
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
  }).catch(() => {
    // Repeated seeds may keep this validation.
  });

  await prisma.printTemplate.upsert({
    where: {
      tenantId_companyId_entityType_name: {
        tenantId: tenant.id,
        companyId: PRIMARY_COMPANY_ID,
        entityType: "sales_invoice",
        name: "Default Sales Invoice",
      },
    },
    create: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      entityType: "sales_invoice",
      name: "Default Sales Invoice",
      templateHtml: "<h1>Sales Invoice {{number}}</h1><p>Customer: {{customer.name}}</p>",
      isDefault: true,
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
    update: {
      templateHtml: "<h1>Sales Invoice {{number}}</h1><p>Customer: {{customer.name}}</p>",
      isDefault: true,
      isActive: true,
      updatedBy: ownerUser.id,
    },
  });

  await prisma.automationRule.create({
    data: {
      tenantId: tenant.id,
      companyId: PRIMARY_COMPANY_ID,
      entityType: "sales_invoice",
      name: "Notify on submit",
      trigger: "ON_SUBMIT",
      actionType: "SEND_NOTIFICATION",
      actionConfig: {
        channel: "in_app",
        template: "sales_invoice_submitted",
      },
      isActive: true,
      createdBy: ownerUser.id,
      updatedBy: ownerUser.id,
    },
  }).catch(() => {
    // Repeated seeds may keep this automation.
  });

  console.log("Seed complete", {
    tenant: { id: tenant.id, key: tenant.key },
    companies: [primaryCompany.company.id, secondaryCompany.company.id],
    users: [ownerUser.email, managerUser.email],
    defaultPassword: SYSTEM_SEED_PASSWORD,
    demoLevelUsersEnabled: IAM_DEMO_USERS_ENABLED,
    demoLevelUsers: IAM_DEMO_USERS_ENABLED ? DEMO_LEVEL_EMAILS : undefined,
  });
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
