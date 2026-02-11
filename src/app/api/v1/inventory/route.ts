import { prisma } from "@/lib/prisma";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { jsonOk, withInventoryAuth } from "@/modules/inventory/interface/http";

export async function GET(request: Request) {
  return withInventoryAuth(request, inventoryPermissions.itemRead, async (ctx) => {
    const [items, documents, warehouses] = await Promise.all([
      prisma.product.count({ where: { companyId: ctx.companyId } }),
      prisma.inventoryDocument.count({ where: { companyId: ctx.companyId } }),
      prisma.inventoryWarehouse.count({ where: { companyId: ctx.companyId } }),
    ]);

    return jsonOk({
      companyId: ctx.companyId,
      requestId: ctx.requestId,
      counters: {
        items,
        documents,
        warehouses,
      },
    });
  });
}
