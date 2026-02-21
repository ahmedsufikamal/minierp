import { prisma } from "@/lib/prisma";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      items,
      documents,
      warehouses,
      openDocuments,
      reorderRules,
      lowStockRows,
      recentMovements,
      stockByWarehouse,
      moverAggregates,
    ] = await Promise.all([
      prisma.product.count({ where: { companyId: ctx.companyId } }),
      prisma.inventoryDocument.count({ where: { companyId: ctx.companyId } }),
      prisma.inventoryWarehouse.count({ where: { companyId: ctx.companyId } }),
      prisma.inventoryDocument.count({
        where: {
          companyId: ctx.companyId,
          status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] },
        },
      }),
      prisma.inventoryReorderRule.count({
        where: { companyId: ctx.companyId, isActive: true },
      }),
      prisma.inventoryStockBalance.findMany({
        where: {
          companyId: ctx.companyId,
          item: {
            lowStockThreshold: { not: null },
          },
        },
        select: {
          onHand: true,
          reserved: true,
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              lowStockThreshold: true,
            },
          },
          warehouse: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      prisma.inventoryLedgerEntry.findMany({
        where: { companyId: ctx.companyId },
        include: {
          item: { select: { id: true, sku: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
        },
        orderBy: { postingTime: "desc" },
        take: 20,
      }),
      prisma.inventoryStockBalance.groupBy({
        by: ["warehouseId"],
        where: { companyId: ctx.companyId },
        _sum: { onHand: true, reserved: true },
      }),
      prisma.inventoryLedgerEntry.groupBy({
        by: ["itemId"],
        where: {
          companyId: ctx.companyId,
          postingTime: { gte: thirtyDaysAgo },
        },
        _sum: {
          quantityDelta: true,
        },
        orderBy: {
          _sum: {
            quantityDelta: "desc",
          },
        },
        take: 50,
      }),
    ]);

    const lowStock = lowStockRows
      .filter((row) => {
        const threshold = row.item.lowStockThreshold ?? 0;
        return row.onHand <= threshold;
      })
      .map((row) => ({
        itemId: row.item.id,
        sku: row.item.sku,
        itemName: row.item.name,
        warehouseId: row.warehouse.id,
        warehouseCode: row.warehouse.code,
        warehouseName: row.warehouse.name,
        onHand: row.onHand,
        reserved: row.reserved,
        threshold: row.item.lowStockThreshold ?? 0,
      }))
      .slice(0, 10);

    const recentMovementData = recentMovements.map((row) => ({
      id: row.id,
      postingTime: row.postingTime.toISOString(),
      quantityDelta: row.quantityDelta,
      qtyIn: row.quantityDelta > 0 ? row.quantityDelta : 0,
      qtyOut: row.quantityDelta < 0 ? Math.abs(row.quantityDelta) : 0,
      itemId: row.item.id,
      sku: row.item.sku,
      itemName: row.item.name,
      warehouseId: row.warehouse.id,
      warehouseCode: row.warehouse.code,
      warehouseName: row.warehouse.name,
      documentId: row.documentId,
    }));

    const warehouseIds = stockByWarehouse.map((row) => row.warehouseId);
    const warehouseLookupRows = warehouseIds.length
      ? await prisma.inventoryWarehouse.findMany({
          where: { companyId: ctx.companyId, id: { in: warehouseIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const warehouseById = new Map(warehouseLookupRows.map((row) => [row.id, row]));
    const onHandByWarehouse = stockByWarehouse.map((row) => ({
      warehouseId: row.warehouseId,
      warehouseCode: warehouseById.get(row.warehouseId)?.code ?? row.warehouseId,
      warehouseName: warehouseById.get(row.warehouseId)?.name ?? row.warehouseId,
      onHand: row._sum.onHand ?? 0,
      reserved: row._sum.reserved ?? 0,
    }));

    const moverRows = moverAggregates
      .map((row) => ({
        itemId: row.itemId,
        netDelta: row._sum.quantityDelta ?? 0,
        magnitude: Math.abs(row._sum.quantityDelta ?? 0),
      }))
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 10);
    const moverItemIds = moverRows.map((row) => row.itemId);
    const moverItems = moverItemIds.length
      ? await prisma.product.findMany({
          where: { companyId: ctx.companyId, id: { in: moverItemIds } },
          select: { id: true, sku: true, name: true },
        })
      : [];
    const moverItemById = new Map(moverItems.map((row) => [row.id, row]));
    const topMovers = moverRows.map((row) => ({
      itemId: row.itemId,
      sku: moverItemById.get(row.itemId)?.sku ?? row.itemId,
      itemName: moverItemById.get(row.itemId)?.name ?? row.itemId,
      netDelta: row.netDelta,
      movementMagnitude: row.magnitude,
    }));

    return jsonOk({
      companyId: ctx.companyId,
      requestId: ctx.requestId,
      generatedAt: new Date().toISOString(),
      counters: {
        items,
        documents,
        warehouses,
        openDocuments,
        reorderRules,
      },
      overview: {
        onHandByWarehouse,
        lowStock,
        recentMovements: recentMovementData,
        topMovers,
      },
    });
  });
}
