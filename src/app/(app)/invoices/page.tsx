import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { NewInvoiceCard, DeleteRowButton } from "./components";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const orgId = await getOrgIdOrUserId();

  const [invoices, customers, products] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { orgId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { orgId },
      select: { id: true, sku: true, name: true, unit: true, priceCents: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle="Create and track sales invoices." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewInvoiceCard customers={customers} products={products} />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Invoice list</div>
            <div className="text-sm text-slate-600">Total: {invoices.length}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th className="w-[90px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                    <td className="px-4 py-3">{inv.customer.name}</td>
                    <td className="px-4 py-3">{inv.status}</td>
                    <td className="px-4 py-3">{formatMoney(inv.totalCents, inv.currency)}</td>
                    <td className="px-4 py-3">
                      <DeleteRowButton id={inv.id} />
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-600" colSpan={5}>
                      No invoices yet. Create your first invoice on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
