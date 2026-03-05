import { InventoryDocumentStatus, InventoryDocumentType, type Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  inventoryDocument: {
    findMany: vi.fn<(args: Prisma.InventoryDocumentFindManyArgs) => Promise<unknown[]>>(async () => []),
    count: vi.fn<(args: Prisma.InventoryDocumentCountArgs) => Promise<number>>(async () => 0),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMocks,
}));

import { listInventoryDocuments } from "@/modules/inventory/application/documents.service";

const ctx: Parameters<typeof listInventoryDocuments>[0] = {
  requestId: "req-1",
  tenantId: "tenant-1",
  companyId: "company-1",
  userId: "user-1",
  role: "INVENTORY_MANAGER",
  iamPermissions: [],
};

beforeEach(() => {
  prismaMocks.inventoryDocument.findMany.mockClear();
  prismaMocks.inventoryDocument.count.mockClear();
  prismaMocks.inventoryDocument.findMany.mockResolvedValue([]);
  prismaMocks.inventoryDocument.count.mockResolvedValue(0);
});

describe("inventory document list query", () => {
  it("applies quick filters and supported sort fields", async () => {
    await listInventoryDocuments(ctx, {
      page: 1,
      limit: 25,
      id: "STE-0001",
      sourceWarehouseId: "wh-source",
      destinationWarehouseId: "wh-target",
      sortField: "id",
      sortDirection: "asc",
    });

    const args = prismaMocks.inventoryDocument.findMany.mock.calls[0]?.[0];
    const where = args?.where as Prisma.InventoryDocumentWhereInput;

    expect(where.companyId).toBe("company-1");
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { number: { contains: "STE-0001", mode: "insensitive" } },
            { id: { contains: "STE-0001", mode: "insensitive" } },
            { externalRef: { contains: "STE-0001", mode: "insensitive" } },
          ]),
        }),
        { sourceWarehouseId: "wh-source" },
        { destinationWarehouseId: "wh-target" },
      ]),
    );
    expect(args?.orderBy).toEqual([{ number: "asc" }, { createdAt: "desc" }]);
  });

  it("maps advanced filters, ignores unsupported mappings, and does not throw", async () => {
    await expect(
      listInventoryDocuments(ctx, {
        page: 1,
        limit: 25,
        filters: JSON.stringify([
          { field: "stockEntryType", op: "contains", value: "trans" },
          { field: "status", op: "contains", value: "post" },
          { field: "createdOn", op: "contains", value: "2026-03-01" },
        ]),
      }),
    ).resolves.toEqual({
      page: 1,
      limit: 25,
      total: 0,
      rows: [],
    });

    const args = prismaMocks.inventoryDocument.findMany.mock.calls[0]?.[0];
    const where = args?.where as Prisma.InventoryDocumentWhereInput;

    expect(where.AND).toEqual(
      expect.arrayContaining([
        { documentType: { in: [InventoryDocumentType.TRANSFER] } },
        { status: { in: [InventoryDocumentStatus.POSTED] } },
      ]),
    );
    expect(where.AND).toHaveLength(2);
  });

  it("falls back to createdAt descending sort by default", async () => {
    await listInventoryDocuments(ctx, {
      page: 1,
      limit: 25,
    });

    const args = prismaMocks.inventoryDocument.findMany.mock.calls[0]?.[0];

    expect(args?.orderBy).toEqual([{ createdAt: "desc" }]);
  });
});
