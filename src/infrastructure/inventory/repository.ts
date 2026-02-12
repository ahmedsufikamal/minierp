import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export function inventoryRepo(client: DbClient = prisma) {
  return {
    findSnapshotByHash: (companyId: string, sourceFileHash: string) =>
      client.inventorySnapshot.findUnique({
        where: { companyId_sourceFileHash: { companyId, sourceFileHash } },
      }),
    createSnapshot: (data: Prisma.InventorySnapshotCreateInput) =>
      client.inventorySnapshot.create({ data }),
    updateSnapshot: (id: string, data: Prisma.InventorySnapshotUpdateInput) =>
      client.inventorySnapshot.update({ where: { id }, data }),
    upsertBrand: (companyId: string, name: string) =>
      client.brand.upsert({
        where: { companyId_name: { companyId, name } },
        create: { companyId, name },
        update: {},
      }),
    upsertCategory: (companyId: string, name: string) =>
      client.category.upsert({
        where: { companyId_name: { companyId, name } },
        create: { companyId, name },
        update: {},
      }),
    upsertSubCategory: (companyId: string, categoryId: string, name: string) =>
      client.subCategory.upsert({
        where: { companyId_categoryId_name: { companyId, categoryId, name } },
        create: { companyId, categoryId, name },
        update: {},
      }),
    upsertProduct: (data: Prisma.ProductUpsertArgs) => client.product.upsert(data),
    upsertLocation: (companyId: string, code: string) =>
      client.stockLocation.upsert({
        where: { companyId_code: { companyId, code } },
        create: { companyId, code, name: code },
        update: {},
      }),
    createLedger: (data: Prisma.StockLedgerUncheckedCreateInput) =>
      client.stockLedger.create({ data }),
    upsertBalance: (data: Prisma.StockBalanceUpsertArgs) =>
      client.stockBalance.upsert(data),
    findLedgerBySnapshot: (companyId: string, snapshotId: string) =>
      client.stockLedger.findMany({
        where: { companyId, snapshotId },
      }),
  };
}
