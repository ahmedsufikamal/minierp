import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createSetupCustomerGroup,
  createSetupItemGroup,
  createSetupSupplierGroup,
  createSetupTerritory,
  createSetupUom,
  listSetupCustomerGroups,
  listSetupItemGroups,
  listSetupSupplierGroups,
  listSetupTerritories,
  listSetupUoms,
} from "@/modules/platform/application/setup-masters.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("setup master data integration", () => {
  const marker = `setup-masters-${Date.now()}`;
  const ctx: PlatformRequestContext = {
    requestId: `${marker}-request`,
    tenantId: `${marker}-tenant`,
    companyId: `${marker}-company`,
    userId: `${marker}-user`,
    role: "OWNER",
    platformRole: "SUPER_ADMIN",
    permissions: [],
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await prisma.setupUomConversionFactor.deleteMany({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } });
    await prisma.setupUom.deleteMany({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } });
    await prisma.setupItemGroup.deleteMany({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } });
    await prisma.setupCustomerGroup.deleteMany({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } });
    await prisma.setupSupplierGroup.deleteMany({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } });
    await prisma.setupTerritory.deleteMany({ where: { tenantId: ctx.tenantId, companyId: ctx.companyId } });
  });

  it("creates and lists item groups, uoms, territories, customer groups, and supplier groups", async () => {
    const rootItemGroup = await createSetupItemGroup(ctx, {
      name: `${marker}-items-root`,
      isGroup: true,
    });
    await createSetupItemGroup(ctx, {
      name: `${marker}-items-child`,
      parentId: rootItemGroup.id,
      isGroup: false,
    });

    const uom = await createSetupUom(ctx, {
      name: `${marker}-PCS`,
      symbol: "pcs",
      mustBeWholeNumber: true,
    });

    const territory = await createSetupTerritory(ctx, {
      name: `${marker}-Dhaka`,
    });

    const customerGroup = await createSetupCustomerGroup(ctx, {
      name: `${marker}-Retail`,
    });

    const supplierGroup = await createSetupSupplierGroup(ctx, {
      name: `${marker}-OEM`,
    });

    const [itemGroups, uoms, territories, customerGroups, supplierGroups] = await Promise.all([
      listSetupItemGroups(ctx, {}),
      listSetupUoms(ctx, {}),
      listSetupTerritories(ctx, {}),
      listSetupCustomerGroups(ctx, {}),
      listSetupSupplierGroups(ctx, {}),
    ]);

    expect(itemGroups).toHaveLength(2);
    expect(itemGroups.some((row) => row.parentId === rootItemGroup.id)).toBe(true);

    expect(uoms).toHaveLength(1);
    expect(uoms[0]?.id).toBe(uom.id);

    expect(territories).toHaveLength(1);
    expect(territories[0]?.id).toBe(territory.id);

    expect(customerGroups).toHaveLength(1);
    expect(customerGroups[0]?.id).toBe(customerGroup.id);

    expect(supplierGroups).toHaveLength(1);
    expect(supplierGroups[0]?.id).toBe(supplierGroup.id);
  });
});
