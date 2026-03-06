import { disconnectPrisma, prisma } from "./prisma-client.mjs";

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
  { key: "inventory.admin.ops", module: "inventory", description: "Run inventory admin operations" },
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
  { key: "admin.members", module: "admin", description: "Manage organization members" },
  { key: "admin.roles", module: "admin", description: "Manage organization roles" },
  { key: "admin.settings", module: "admin", description: "Manage organization settings" },
  { key: "iam.audit.read", module: "iam", description: "Read IAM audit logs" },
  { key: "iam.sessions.revoke", module: "iam", description: "Revoke IAM sessions" },
  { key: "iam.impersonate", module: "iam", description: "Impersonate sessions" },
];

const roleSeeds = [
  { name: "OWNER", isDefault: true, isSystem: true, permissionKeys: permissionCatalog.map((p) => p.key) },
  { name: "ADMIN", isDefault: false, isSystem: true, permissionKeys: permissionCatalog.filter((p) => p.key !== "iam.impersonate").map((p) => p.key) },
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
      "inventory.admin.ops",
      "sales.read",
      "sales.write",
      "finance.read",
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
      "inventory.admin.ops",
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
  { name: "FINANCE_MANAGER", isDefault: false, isSystem: true, permissionKeys: ["finance.read", "finance.write", "sales.read", "inventory.read", "inventory.ledger.read", "inventory.export.read"] },
  { name: "PROCUREMENT_MANAGER", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "inventory.write", "inventory.item.read", "inventory.item.write", "inventory.document.read", "inventory.document.write", "inventory.settings.read", "finance.read"] },
  { name: "MEMBER", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "inventory.item.read", "inventory.document.read", "sales.read", "finance.read"] },
  { name: "VIEWER", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "inventory.item.read", "inventory.document.read", "inventory.ledger.read", "sales.read", "finance.read"] },
  { name: "AUDITOR", isDefault: false, isSystem: true, permissionKeys: ["inventory.read", "inventory.item.read", "inventory.document.read", "inventory.ledger.read", "inventory.export.read", "sales.read", "finance.read", "iam.audit.read"] },
];

async function main() {
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

  const permissionRows = await prisma.iamPermission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissionRows.map((row) => [row.key, row.id]));
  const companies = await prisma.company.findMany({ select: { id: true } });

  for (const company of companies) {
    for (const roleSeed of roleSeeds) {
      const role = await prisma.iamRole.upsert({
        where: {
          companyId_name: {
            companyId: company.id,
            name: roleSeed.name,
          },
        },
        create: {
          companyId: company.id,
          name: roleSeed.name,
          description: `${roleSeed.name} default role`,
          isSystem: roleSeed.isSystem,
          isDefault: roleSeed.isDefault,
        },
        update: {
          isSystem: roleSeed.isSystem,
          isDefault: roleSeed.isDefault,
        },
        select: { id: true },
      });

      for (const key of roleSeed.permissionKeys) {
        const permissionId = permissionIdByKey.get(key);
        if (!permissionId) continue;
        await prisma.iamRolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId,
            },
          },
          create: {
            roleId: role.id,
            permissionId,
          },
          update: {},
        });
      }
    }

    await prisma.companyMembership.updateMany({
      where: { companyId: company.id, role: "COMPANY_OWNER" },
      data: { role: "OWNER" },
    });
    await prisma.companyMembership.updateMany({
      where: { companyId: company.id, role: "COMPANY_ADMIN" },
      data: { role: "ADMIN" },
    });
    await prisma.companyMembership.updateMany({
      where: { companyId: company.id, role: "USER" },
      data: { role: "MEMBER" },
    });

    const roles = await prisma.iamRole.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true },
    });
    for (const role of roles) {
      await prisma.companyMembership.updateMany({
        where: {
          companyId: company.id,
          role: role.name,
          OR: [{ roleId: null }, { roleId: { not: role.id } }],
        },
        data: { roleId: role.id },
      });
    }
  }

  console.log("IAM backfill complete", { companies: companies.length });
}

main()
  .catch((error) => {
    console.error("IAM backfill failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
