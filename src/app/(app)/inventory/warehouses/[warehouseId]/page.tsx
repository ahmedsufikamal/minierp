import { notFound } from "next/navigation";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ warehouseId: string }> };

export default async function WarehouseDetailPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const { warehouseId } = await props.params;

  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: { id: warehouseId, companyId },
    include: {
      locations: { orderBy: [{ path: "asc" }, { code: "asc" }] },
      balances: {
        include: {
          item: { select: { sku: true, name: true, uom: true } },
          location: { select: { code: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!warehouse) notFound();

  return (
    <div className="space-y-4">
      <PageHeader title={`${warehouse.code} - ${warehouse.name}`} subtitle="Warehouse detail and stock view." />

      <section className="surface-1 p-4">
        <h2 className="mb-2 text-sm font-semibold">Locations</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {warehouse.locations.map((location) => (
            <div key={location.id} className="rounded-md border border-border p-2 text-sm">
              <div className="font-medium">{location.code}</div>
              <div className="text-muted-foreground">{location.name}</div>
            </div>
          ))}
          {warehouse.locations.length === 0 && <p className="text-sm text-muted-foreground">No locations defined.</p>}
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-2 text-sm font-semibold">Balances</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">SKU</th>
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Location</th>
                <th className="px-2 py-1.5">On Hand</th>
                <th className="px-2 py-1.5">Reserved</th>
                <th className="px-2 py-1.5">Incoming</th>
                <th className="px-2 py-1.5">Outgoing</th>
              </tr>
            </thead>
            <tbody>
              {warehouse.balances.map((balance) => (
                <tr key={balance.id} className="border-t border-border">
                  <td className="px-2 py-1.5 font-mono text-xs">{balance.item.sku}</td>
                  <td className="px-2 py-1.5">{balance.item.name}</td>
                  <td className="px-2 py-1.5">{balance.location?.code ?? "-"}</td>
                  <td className="px-2 py-1.5">{balance.onHand}</td>
                  <td className="px-2 py-1.5">{balance.reserved}</td>
                  <td className="px-2 py-1.5">{balance.incoming}</td>
                  <td className="px-2 py-1.5">{balance.outgoing}</td>
                </tr>
              ))}
              {warehouse.balances.length === 0 && (
                <tr>
                  <td className="px-2 py-4 text-muted-foreground" colSpan={7}>No balances yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
