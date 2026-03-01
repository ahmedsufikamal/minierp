import { NumberSeriesResetPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { upsertNumberSeries } from "@/modules/platform/application/numbering.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const defaultDocumentTypes = [
  { code: "COMM_INV", name: "Commercial Invoice", sortOrder: 10 },
  { code: "PACK_LIST", name: "Packing List", sortOrder: 20 },
  { code: "BL_AWB", name: "Bill of Lading / AWB", sortOrder: 30 },
  { code: "COO", name: "Certificate of Origin", sortOrder: 40 },
  { code: "INSURANCE", name: "Insurance", sortOrder: 50 },
  { code: "INSPECTION", name: "Inspection Certificate", sortOrder: 60 },
] as const;

const defaultChargeTypes = [
  { code: "COMMISSION", name: "Commission", defaultAllocatable: false },
  { code: "SWIFT", name: "SWIFT", defaultAllocatable: false },
  { code: "COURIER", name: "Courier", defaultAllocatable: false },
  { code: "STAMP", name: "Stamp", defaultAllocatable: false },
  { code: "VAT", name: "VAT", defaultAllocatable: false },
  { code: "DISCREPANCY_FEE", name: "Discrepancy Fee", defaultAllocatable: false },
  { code: "OTHER", name: "Other", defaultAllocatable: false },
] as const;

const defaultIncoterms = [
  { code: "FOB", name: "FOB" },
  { code: "CIF", name: "CIF" },
  { code: "CFR", name: "CFR" },
  { code: "EXW", name: "EXW" },
  { code: "DAP", name: "DAP" },
  { code: "DDP", name: "DDP" },
] as const;

export async function ensureTradeLcDefaults(ctx: PlatformRequestContext) {
  await upsertNumberSeries(ctx, {
    key: "TRADE_LC",
    name: "Letter of Credit",
    pattern: "LC-{FY}-{####}",
    resetPolicy: NumberSeriesResetPolicy.FISCAL_YEAR,
    startAt: 1,
    padding: 4,
    isActive: true,
  });

  await prisma.tradeLcSetting.upsert({
    where: {
      tenantId_companyId: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {
      updatedBy: ctx.userId,
    },
  });

  for (const entry of defaultDocumentTypes) {
    await prisma.tradeLcDocumentType.upsert({
      where: {
        tenantId_companyId_code: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          code: entry.code,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        code: entry.code,
        name: entry.name,
        sortOrder: entry.sortOrder,
        defaultRequired: true,
        isActive: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      update: {
        name: entry.name,
        sortOrder: entry.sortOrder,
        updatedBy: ctx.userId,
      },
    });
  }

  for (const entry of defaultChargeTypes) {
    await prisma.tradeLcChargeType.upsert({
      where: {
        tenantId_companyId_code: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          code: entry.code,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        code: entry.code,
        name: entry.name,
        defaultAllocatable: entry.defaultAllocatable,
        isActive: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      update: {
        name: entry.name,
        defaultAllocatable: entry.defaultAllocatable,
        updatedBy: ctx.userId,
      },
    });
  }

  for (const entry of defaultIncoterms) {
    await prisma.tradeLcIncoterm.upsert({
      where: {
        tenantId_companyId_code: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          code: entry.code,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        code: entry.code,
        name: entry.name,
        isActive: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      update: {
        name: entry.name,
        updatedBy: ctx.userId,
      },
    });
  }
}
