import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatCents(value: number): string {
  return `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function GeneralLedgerPage() {
  const companyId = await getCompanyIdOrUserId();
  const rows = await prisma.gLEntry.findMany({
    where: { companyId },
    include: {
      account: {
        select: { code: true, name: true, type: true, rootType: true },
      },
    },
    orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="General Ledger" subtitle="Append-only accounting entries created from posted journal entries." />
      <div className="rounded-2xl border">
        <div className="flex items-center justify-between border-b p-4">
          <div className="text-sm text-slate-600">Latest {rows.length} GL rows</div>
          <Link href="/accounting/journal-entries" className="text-sm underline underline-offset-4">
            Journal entries
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                <th>Posting Date</th>
                <th>Account</th>
                <th>Type</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Voucher</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{row.postingDate.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    {row.account.code} {row.account.name}
                  </td>
                  <td className="px-4 py-3">{row.account.rootType ?? row.account.type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatCents(row.debitCents)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatCents(row.creditCents)}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.voucherType ?? "—"} {row.voucherId ?? ""}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={6}>
                    No GL rows found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
