"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type GlRow = {
  id: string;
  postingDate: string;
  debitCents: number;
  creditCents: number;
  currency: string;
  voucherType: string | null;
  voucherId: string | null;
  metadata?: {
    exchangeRate?: number | null;
    costCenterId?: string | null;
    dimensions?: Record<string, string> | null;
  } | null;
  account: {
    code: string;
    name: string;
    rootType?: string | null;
    type: string;
  };
};

type GlListResponse = {
  page: number;
  pageSize: number;
  total: number;
  rows: GlRow[];
};

function formatCents(value: number): string {
  return `$${(value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function GeneralLedgerPage() {
  const [page, setPage] = useState(1);
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const query = useQuery({
    queryKey: queryKeys.list("accounting", "gl", {
      page,
      pageSize: 50,
      accountId: accountId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    queryFn: () =>
      apiGet<GlListResponse>("/api/v1/accounting/gl", {
        query: {
          page,
          pageSize: 50,
          accountId: accountId || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      }),
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 50;

  const canPrev = page > 1;
  const canNext = page * pageSize < total;

  const filtersSummary = useMemo(() => {
    const chunks = [] as string[];
    if (accountId) chunks.push(`Account ${accountId}`);
    if (fromDate) chunks.push(`From ${fromDate}`);
    if (toDate) chunks.push(`To ${toDate}`);
    return chunks.length > 0 ? chunks.join(" · ") : "No filters";
  }, [accountId, fromDate, toDate]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger"
        subtitle="Append-only accounting entries with currency and posting-dimension trace metadata."
      />

      <div className="rounded-2xl border p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by account id"
          />
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
          <Button type="button" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            Refresh
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtersSummary}</span>
          <span>Total rows: {total}</span>
        </div>
      </div>

      <div className="rounded-2xl border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b [&>th]:px-4 [&>th]:py-3">
                <th>Posting Date</th>
                <th>Account</th>
                <th>Type</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Currency</th>
                <th>FX Rate</th>
                <th>Cost Center</th>
                <th>Dimensions</th>
                <th>Voucher</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{row.postingDate.slice(0, 10)}</td>
                  <td className="px-4 py-3">{row.account.code} {row.account.name}</td>
                  <td className="px-4 py-3">{row.account.rootType ?? row.account.type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatCents(row.debitCents)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatCents(row.creditCents)}</td>
                  <td className="px-4 py-3">{row.currency}</td>
                  <td className="px-4 py-3">{row.metadata?.exchangeRate ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.metadata?.costCenterId ? <Badge variant="outline">{row.metadata.costCenterId}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.metadata?.dimensions ? (
                      <pre className="max-w-[220px] overflow-auto text-[10px] text-muted-foreground">
                        {JSON.stringify(row.metadata.dimensions, null, 2)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.voucherType ?? "—"} {row.voucherId ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    {query.isLoading ? "Loading ledger rows..." : "No GL rows found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t p-4">
          <Button type="button" variant="outline" size="sm" disabled={!canPrev} onClick={() => setPage((prev) => prev - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button type="button" variant="outline" size="sm" disabled={!canNext} onClick={() => setPage((prev) => prev + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
