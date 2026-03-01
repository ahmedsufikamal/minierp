import { prisma } from "@/lib/prisma";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { StockEntryListClient } from "./stock-entry-list-client";

export const dynamic = "force-dynamic";

export default async function StockEntryPage() {
  const ctx = await getInventoryPageContext(inventoryPermissions.documentRead);

  const warehouses = await prisma.inventoryWarehouse.findMany({
    where: {
      companyId: ctx.companyId,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  return <StockEntryListClient warehouseOptions={warehouses} />;
}
