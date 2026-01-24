import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import {
  NewAccountCard,
  NewJournalEntryCard,
  DeleteAccountButton,
  DeleteEntryButton,
  AmountCell,
} from "./components";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const orgId = await getOrgIdOrUserId();

  const [accounts, entries] = await Promise.all([
    prisma.account.findMany({
      where: { orgId },
      orderBy: [{ code: "asc" }],
    }),
    prisma.journalEntry.findMany({
      where: { orgId },
      include: { lines: { include: { account: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting"
        subtitle="Chart of accounts + simple double-entry journal."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <NewAccountCard />
          <NewJournalEntryCard accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Chart of accounts</div>
              <div className="text-sm text-slate-600">Total: {accounts.length}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th className="w-[90px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3">{a.type}</td>
                      <td className="px-4 py-3">
                        <DeleteAccountButton id={a.id} />
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-600" colSpan={4}>
                        No accounts yet. Click “Init chart of accounts” on Dashboard for a quick setup.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Journal entries</div>
              <div className="text-sm text-slate-600">Latest {entries.length} entries</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-600">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>Date</th>
                    <th>Memo</th>
                    <th>Lines</th>
                    <th className="w-[90px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {e.date.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">{e.memo ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="grid gap-1">
                          {e.lines.map((l) => (
                            <div key={l.id} className="flex items-center justify-between gap-4">
                              <span className="text-slate-700">
                                {l.account.code} — {l.account.name}
                              </span>
                              <AmountCell debitCents={l.debitCents} creditCents={l.creditCents} />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DeleteEntryButton id={e.id} />
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-600" colSpan={4}>
                        No journal entries yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
