"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LCTable } from "@/components/trade/lc/lc-table";

const reports = [
  { key: "register", label: "Register" },
  { key: "expiry", label: "Expiry" },
  { key: "outstanding", label: "Outstanding" },
  { key: "charges", label: "Charges" },
  { key: "discrepancies", label: "Discrepancies" },
] as const;

export function LCReportsClient() {
  const [reportKey, setReportKey] = useState<(typeof reports)[number]["key"]>("register");
  const [status, setStatus] = useState("");

  const endpoint = `/api/v1/trade/lc/reports/${reportKey}`;
  const reportQuery = useQuery({
    queryKey: queryKeys.list("trade", `report-${reportKey}`, { status }),
    queryFn: () => apiGet<Array<Record<string, unknown>>>(endpoint, { query: { status: status || undefined } }),
  });

  const rows = reportQuery.data ?? [];
  const columns = useMemo(() => {
    const first = rows[0];
    if (!first) {
      return [
        { key: "placeholder", label: "Report", render: () => "No rows" },
      ];
    }
    return Object.keys(first)
      .slice(0, 6)
      .map((key) => ({
        key,
        label: key,
        render: (row: Record<string, unknown>) => {
          const value = row[key];
          if (value === null || value === undefined) return "—";
          if (typeof value === "boolean") return value ? "Yes" : "No";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        },
      }));
  }, [rows]);

  const selectClassName =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="reportKey">Report</Label>
            <select id="reportKey" className={selectClassName} value={reportKey} onChange={(e) => setReportKey(e.target.value as typeof reportKey)}>
              {reports.map((report) => (
                <option key={report.key} value={report.key}>
                  {report.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reportStatus">Status</Label>
            <input id="reportStatus" className={selectClassName} value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Optional status filter" />
          </div>
          <div className="flex items-end">
            <Button asChild variant="outline">
              <a href={`${endpoint}?format=csv${status ? `&status=${encodeURIComponent(status)}` : ""}`}>Export CSV</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <LCTable
            rows={rows as Array<any>}
            emptyLabel={reportQuery.isLoading ? "Loading..." : "No rows found."}
            columns={columns as any}
          />
        </CardContent>
      </Card>
    </div>
  );
}
