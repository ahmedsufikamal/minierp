import Link from "next/link";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function InventoryLedgerPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};

  const itemId = typeof searchParams.itemId === "string" ? searchParams.itemId : undefined;
  const warehouseId = typeof searchParams.warehouseId === "string" ? searchParams.warehouseId : undefined;

  const [entries, items, warehouses] = await Promise.all([
    prisma.inventoryLedgerEntry.findMany({
      where: {
        companyId,
        ...(itemId ? { itemId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { code: true } },
        document: { select: { id: true, number: true } },
      },
      orderBy: { postingTime: "desc" },
      take: 400,
    }),
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

  const totalDelta = entries.reduce((sum, entry) => sum + entry.quantityDelta, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title="Inventory Ledger" subtitle="Immutable stock postings by document and location." />
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory/reorder">Open Reorder</Link>
        </Button>
      </div>

      <form className="surface-1 grid gap-2 p-4 sm:grid-cols-3">
        <select name="itemId" defaultValue={itemId ?? ""} className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
          <option value="">All items</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>
          ))}
        </select>

        <select name="warehouseId" defaultValue={warehouseId ?? ""} className="focus-ring h-9 rounded-md border border-border bg-[hsl(var(--surface-2))] px-2 text-sm">
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>
          ))}
        </select>

        <Button type="submit" variant="outline">Apply filters</Button>
      </form>

      <section className="surface-1 overflow-hidden">
        <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
          Rows: {entries.length} | Net Delta: {totalDelta}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Doc</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Delta</th>
                <th className="px-3 py-2">Unit Cost</th>
                <th className="px-3 py-2">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-3 py-2">{entry.postingTime.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {entry.document ? (
                      <Link href={`/inventory/documents/${entry.document.id}`} className="text-primary hover:underline">
                        {entry.document.number}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">{entry.item.sku}</td>
                  <td className="px-3 py-2">{entry.warehouse.code}</td>
                  <td className="px-3 py-2">{entry.location?.code ?? "-"}</td>
                  <td className="px-3 py-2 font-medium">{entry.quantityDelta}</td>
                  <td className="px-3 py-2">{formatMoney(entry.unitCostMinor ?? 0, "BDT")}</td>
                  <td className="px-3 py-2">{formatMoney(entry.totalCostMinor ?? 0, "BDT")}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No ledger entries found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
