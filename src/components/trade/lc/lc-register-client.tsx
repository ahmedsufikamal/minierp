"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { LCTable } from "@/components/trade/lc/lc-table";
import { LCStatusBadge } from "@/components/trade/lc/lc-status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type ListResponse = {
  rows: Array<{
    id: string;
    displayLcNo: string;
    beneficiaryName: string;
    issuingBankName: string;
    currency?: string | null;
    lcAmount?: number | string | null;
    expiryDate: string;
    latestShipmentDate?: string | null;
    status: string;
  }>;
  total: number;
};

export function LCRegisterClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const list = useQuery({
    queryKey: queryKeys.list("trade", "lc", { query, status }),
    queryFn: () =>
      apiGet<ListResponse>("/api/v1/trade/lc", {
        query: {
          query: query || undefined,
          status: status || undefined,
          limit: 50,
        },
      }),
  });

  const selectClassName =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="query">Search</Label>
            <Input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="LC no, supplier, bank" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <select id="status" className={selectClassName} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {["DRAFT", "REQUESTED", "APPROVED", "ISSUED", "ACTIVE", "DOCS_RECEIVED", "UNDER_SCRUTINY", "DISCREPANT", "ACCEPTED", "SETTLED", "CLOSED", "CANCELLED", "EXPIRED"].map((entry) => (
                <option key={entry} value={entry}>
                  {entry.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <LCTable
            rows={list.data?.rows ?? []}
            emptyLabel={list.isLoading ? "Loading..." : "No LCs found."}
            onRowClick={(row) => row.id && router.push(`/trade/lc/${row.id}`)}
            columns={[
              { key: "displayLcNo", label: "LC No", render: (row) => row.displayLcNo },
              { key: "beneficiaryName", label: "Supplier", render: (row) => row.beneficiaryName },
              { key: "issuingBankName", label: "Bank", render: (row) => row.issuingBankName },
              {
                key: "amount",
                label: "Amount",
                render: (row) =>
                  new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: row.currency || "USD",
                    maximumFractionDigits: 2,
                  }).format(Number(row.lcAmount ?? 0)),
              },
              {
                key: "expiryDate",
                label: "Expiry",
                render: (row) => new Date(row.expiryDate).toLocaleDateString(),
              },
              {
                key: "latestShipmentDate",
                label: "Latest Shipment",
                render: (row) =>
                  row.latestShipmentDate ? new Date(row.latestShipmentDate).toLocaleDateString() : "—",
              },
              { key: "status", label: "Status", render: (row) => <LCStatusBadge status={row.status} /> },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
