import Link from "next/link";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatCents(value: number): string {
  return `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function JournalEntriesPage() {
  const companyId = await getCompanyIdOrUserId();
  const entries = await prisma.journalEntry.findMany({
    where: { companyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      lines: {
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { lineNo: "asc" },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Journal Entries" subtitle="Draft and submitted entries with line-level details." />
      <div className="rounded-2xl border">
        <div className="flex items-center justify-between border-b p-4">
          <div className="text-sm text-slate-600">Latest {entries.length} entries</div>
          <Link href="/accounting" className="text-sm underline underline-offset-4">
            Create new entry
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                <th>Date</th>
                <th>Number</th>
                <th>Status</th>
                <th>Total Debit</th>
                <th>Total Credit</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{entry.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">{entry.number ?? "—"}</td>
                  <td className="px-4 py-3">{entry.status}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatCents(entry.totalDebitCents)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatCents(entry.totalCreditCents)}</td>
                  <td className="px-4 py-3">
                    <div className="grid gap-1">
                      {entry.lines.map((line) => (
                        <div key={line.id} className="flex items-center justify-between gap-4 text-xs">
                          <span>
                            {line.account.code} {line.account.name}
                          </span>
                          <span className="text-slate-600">
                            Dr {formatCents(line.debitCents)} / Cr {formatCents(line.creditCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-600" colSpan={6}>
                    No journal entries found.
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
