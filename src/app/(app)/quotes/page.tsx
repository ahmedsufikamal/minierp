import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import {
  NewQuoteCard,
  QuoteStatusSelect,
  DeleteQuoteButton,
  ConvertToInvoiceButton,
} from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { formatMoney } from "@/lib/utils";
import { getPaginationParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function QuotesPage(props: PageProps) {
  const orgId = await getOrgIdOrUserId();
  const searchParams = (await props.searchParams?.()) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });

  const [quotes, total, customers, products] = await Promise.all([
    prisma.quote.findMany({
      where: { orgId },
      include: { customer: true, lines: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.quote.count({ where: { orgId } }),
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

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Convert</th>
                  <th className="w-[90px]">Action</th>
                </tr>
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
          <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
        </div>
      </div>
    </div>
  );
}
