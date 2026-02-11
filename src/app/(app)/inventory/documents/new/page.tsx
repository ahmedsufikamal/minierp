import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { InventoryDocumentEditor } from "../document-editor";

export const dynamic = "force-dynamic";

export default async function NewInventoryDocumentPage() {
  const companyId = await getCompanyIdOrUserId();

  const [items, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        uom: true,
        unitCostMinor: true,
      },
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
        title="New Inventory Document"
        subtitle="Create receipts, issues, transfers, adjustments, and cycle counts."
      />
      <InventoryDocumentEditor items={items} warehouses={warehouses} />
    </div>
  );
}
