import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { NewPaymentCard } from "./components";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { Banknote } from "lucide-react";
import { getPaginationParams, getTotalPages } from "@/lib/pagination";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function PaymentsPage(props: PageProps) {
  const companyId = await getCompanyIdOrUserId();
  const searchParams = (await props.searchParams) ?? {};
  const { page, limit, skip } = getPaginationParams(searchParams as { page?: string; limit?: string });

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { companyId },
      include: {
        invoice: { select: { id: true, number: true } },
        bill: { select: { id: true, number: true } },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { companyId } }),
  ]);

  const totalPages = getTotalPages(total, limit);

  const [invoices, bills] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { companyId, status: { not: "PAID" } },
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    }),
    prisma.purchaseBill.findMany({
      where: { companyId, status: { not: "PAID" } },
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Record payments against invoices and bills." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <NewPaymentCard invoices={invoices} bills={bills} />
        </div>

        <div className="lg:col-span-2 rounded-2xl border">
          <div className="p-4 border-b">
            <div className="font-medium">Payment list</div>
            <div className="text-sm text-muted-foreground">Total: {total}</div>
          </div>

          {payments.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No payments yet"
              description="Record payments against invoices and bills."
              action={
                <Button asChild>
                  <Link href="#add-payment">Record first payment</Link>
                </Button>
              }
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Method</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Invoice / Bill</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{p.type}</td>
                    <td className="px-4 py-3">{formatMoney(p.amountCents)}</td>
                    <td className="px-4 py-3">{p.method}</td>
                    <td className="px-4 py-3">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.invoice ? `Invoice ${p.invoice.number}` : p.bill ? `Bill ${p.bill.number}` : "—"}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-muted-foreground" colSpan={6}>
                      No payments yet. Record a payment on the left.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          )}
          {payments.length > 0 && (
            <PaginationLinks page={page} totalPages={totalPages} total={total} limit={limit} />
          )}
        </div>
      </div>
    </div>
  );
}
