import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getReorderSuggestions } from "@/modules/inventory/application/reorder.service";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { ReorderClient } from "./reorder-client";

export const dynamic = "force-dynamic";

export default async function InventoryReorderPage() {
  const ctx = await getInventoryPageContext(inventoryPermissions.itemRead);
  const companyId = ctx.companyId;

  const [rules, suggestions, items, warehouses] = await Promise.all([
    prisma.inventoryReorderRule.findMany({
      where: { companyId },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    getReorderSuggestions(ctx),
    prisma.product.findMany({
      where: { companyId, isActive: true },
      select: { id: true, sku: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.inventoryWarehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reorder"
        subtitle="Manage reorder rules and generate stock replenishment suggestions."
      />
      <ReorderClient
        rules={rules.map((rule) => ({
          id: rule.id,
          item: rule.item,
          warehouse: rule.warehouse,
          reorderPoint: rule.reorderPoint,
          reorderQty: rule.reorderQty,
          minQty: rule.minQty,
          maxQty: rule.maxQty,
          leadTimeDays: rule.leadTimeDays,
        }))}
        suggestions={suggestions}
        items={items}
        warehouses={warehouses}
      />
    </div>
  );
}
