import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { NewInvoiceCard, DeleteRowButton, InvoiceStatusSelect, InvoiceTableHead } from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { FileText } from "lucide-react";
import { getPaginationParams, getSearchQuery, getSortParams, getTotalPages } from "@/lib/pagination";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function InvoicesPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });
  const { sort, order } = getSortParams(searchParams as { sort?: string; order?: string });
  const q = getSearchQuery(searchParams as { q?: string });
  const sortKey =
    sort === "number" || sort === "invoiceDate" || sort === "createdAt" ? sort : "createdAt";
  const orderBy = { [sortKey]: order };
  const where = q
    ? { companyId, number: { contains: q, mode: "insensitive" as const } }
    : { companyId };

  const [invoices, total, customers, products] = await Promise.all([
    prisma.salesInvoice.findMany({
      where,
      include: { customer: true, lines: true },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.salesInvoice.count({ where }),
    prisma.customer.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId },
      select: { id: true, sku: true, name: true, uom: true, priceCents: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = getTotalPages(total, limit);

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle="Create and track sales invoices." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewInvoiceCard customers={customers} products={products} />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-medium">Invoice list</div>
              <div className="text-sm text-muted-foreground">Total: {total}</div>
            </div>
            <SearchInput name="q" placeholder="Search by number…" defaultValue={q ?? ""} className="max-w-sm" />
          </div>

          {invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Create your first invoice to track sales."
              action={
                <Button asChild>
                  <Link href="#add-invoice">Create first invoice</Link>
                </Button>
              }
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <InvoiceTableHead sort={sortKey} order={order} />
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                    <td className="px-4 py-3">{inv.customer.name}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusSelect id={inv.id} currentStatus={inv.status} />
                    </td>
                    <td className="px-4 py-3">{formatMoney(inv.lines.reduce((acc, line) => acc + line.qty * line.unitPriceCents, 0))}</td>
                    <td className="px-4 py-3">
                      <DeleteRowButton id={inv.id} label={inv.number} />
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-muted-foreground" colSpan={5}>
                      No invoices yet. Create your first invoice on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          )}
          {invoices.length > 0 && (
            <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
          )}
        </div>
      </div>
    </div>
  );
}
