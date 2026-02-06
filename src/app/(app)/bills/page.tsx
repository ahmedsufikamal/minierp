import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { NewBillCard, DeleteRowButton, BillStatusSelect } from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { formatMoney } from "@/lib/utils";
import { getPaginationParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function BillsPage(props: PageProps) {
  const orgId = await getOrgIdOrUserId();
  const searchParams = (await props.searchParams?.()) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });

  const [bills, total, vendors, products] = await Promise.all([
    prisma.purchaseBill.findMany({
      where: { orgId },
      include: { vendor: true, lines: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.purchaseBill.count({ where: { orgId } }),
    prisma.vendor.findMany({
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

  const totalPages = getTotalPages(total, limit);

  return (
    <div className="space-y-6">
      <PageHeader title="Bills" subtitle="Record vendor bills and keep payables organized." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewBillCard vendors={vendors} products={products} />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Bill list</div>
            <div className="text-sm text-slate-600">Total: {total}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th>Number</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th className="w-[90px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{b.number}</td>
                    <td className="px-4 py-3">{b.vendor.name}</td>
                    <td className="px-4 py-3">
                      <BillStatusSelect id={b.id} currentStatus={b.status} />
                    </td>
                    <td className="px-4 py-3">{formatMoney(b.lines.reduce((acc, line) => acc + line.qty * line.unitPriceCents, 0))}</td>
                    <td className="px-4 py-3">
                      <DeleteRowButton id={b.id} label={b.number} />
                    </td>
                  </tr>
                ))}
                {bills.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-600" colSpan={5}>
                      No bills yet. Create your first bill on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
        </div>
      </div>
    </div>
  );
}
