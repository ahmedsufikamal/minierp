import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { flattenAccountTree } from "@/modules/accounting/application/accounts.service";
import Link from "next/link";
import {
  NewAccountCard,
  NewJournalEntryCard,
  DeleteAccountButton,
  DeleteEntryButton,
  AmountCell,
} from "./components";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const companyId = await getCompanyIdOrUserId();

  const [accounts, entries] = await Promise.all([
    prisma.account.findMany({
      where: { companyId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isGroup: true,
      },
    }),
    prisma.journalEntry.findMany({
      where: { companyId },
      include: { lines: { include: { account: true } } },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  const accountRows = flattenAccountTree(accounts);

  return (
    <div className="space-y-6">
      <PageHeader title="Accounting" subtitle="Chart of accounts + simple double-entry journal." />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/accounting/coa" className="rounded-md border px-3 py-1.5 hover:bg-[hsl(var(--surface-elevated))]">
          COA
        </Link>
        <Link href="/accounting/journal-entries" className="rounded-md border px-3 py-1.5 hover:bg-[hsl(var(--surface-elevated))]">
          Journal Entries
        </Link>
        <Link href="/accounting/gl" className="rounded-md border px-3 py-1.5 hover:bg-[hsl(var(--surface-elevated))]">
          General Ledger
        </Link>
        <Link href="/accounting/periods" className="rounded-md border px-3 py-1.5 hover:bg-[hsl(var(--surface-elevated))]">
          Fiscal Periods
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <NewAccountCard />
          <NewJournalEntryCard
            accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border">
            <div className="p-4 border-b">
              <div className="font-medium">Chart of accounts</div>
              <div className="text-sm text-muted-foreground">Total: {accounts.length}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="[&>th]:px-4 [&>th]:py-3 border-b">
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Posting</th>
                    <th className="w-[90px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${a.depth * 16}px` }}>
                          {a.isGroup ? <span className="text-muted-foreground">▾</span> : null}
                          <span>{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{a.type}</td>
                      <td className="px-4 py-3">
                        {a.isGroup ? (
                          <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-xs text-muted-foreground">
                            Group
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Posting</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <DeleteAccountButton
                          id={a.id}
                          disabled={a.isGroup || a.hasChildren}
                          disabledReason={
                            a.hasChildren
                              ? "Group accounts with children cannot be deleted."
                              : a.isGroup
                                ? "Group accounts cannot be deleted."
                                : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-muted-foreground" colSpan={5}>
                        No accounts yet. Click “Init chart of accounts” on Dashboard for a quick
                        setup.
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
              <div className="text-sm text-muted-foreground">Latest {entries.length} entries</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
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
                              <span className="text-foreground">
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
                      <td className="px-4 py-8 text-muted-foreground" colSpan={4}>
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
