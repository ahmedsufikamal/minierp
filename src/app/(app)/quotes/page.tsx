import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import {
  NewQuoteCard,
  QuoteStatusSelect,
  DeleteQuoteButton,
  ConvertToInvoiceButton,
  QuoteTableHead,
} from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { FileSignature } from "lucide-react";
import { getPaginationParams, getSortParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function QuotesPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });
  const { sort, order } = getSortParams(searchParams as { sort?: string; order?: string });
  const sortKey =
    sort === "number" || sort === "quoteDate" || sort === "createdAt" ? sort : "createdAt";
  const orderBy = { [sortKey]: order };

  const [quotes, total, customers, products] = await Promise.all([
    prisma.quote.findMany({
      where: { companyId },
      include: { customer: true, lines: true },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.quote.count({ where: { companyId } }),
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
      <PageHeader title="Quotes" subtitle="Create quotes and convert them to invoices." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewQuoteCard customers={customers} products={products} />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Quote list</div>
            <div className="text-sm text-slate-600">Total: {total}</div>
          </div>

          {quotes.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No quotes yet"
              description="Create quotes and convert them to invoices."
              action={
                <Button asChild>
                  <Link href="#add-quote">Create first quote</Link>
                </Button>
              }
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-sm">
              <thead className="text-left text-slate-600">
                <QuoteTableHead sort={sortKey} order={order} />
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{q.number}</td>
                    <td className="px-4 py-3">{q.customer.name}</td>
                    <td className="px-4 py-3">
                      <QuoteStatusSelect id={q.id} currentStatus={q.status} />
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(
                        q.lines.reduce((acc, line) => acc + line.qty * line.unitPriceCents, 0),
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ConvertToInvoiceButton
                        quoteId={q.id}
                        converted={!!q.convertedToInvoiceId}
                        status={q.status}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <DeleteQuoteButton
                        id={q.id}
                        canDelete={!q.convertedToInvoiceId}
                        label={q.number}
                      />
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-slate-600" colSpan={6}>
                      No quotes yet. Create your first quote on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          )}
          {quotes.length > 0 && (
            <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
          )}
        </div>
      </div>
    </div>
  );
}
