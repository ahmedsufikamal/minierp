"use client";

import { LCStatusBadge } from "@/components/trade/lc/lc-status-badge";
import { LCTable } from "@/components/trade/lc/lc-table";

type Discrepancy = {
  id: string;
  code: string;
  title: string;
  severity: string;
  decision: string;
  decisionNotes?: string | null;
};

export function LCDiscrepancyPanel({ rows }: { rows: Discrepancy[] }) {
  return (
    <LCTable
      rows={rows}
      columns={[
        { key: "code", label: "Code", render: (row) => row.code },
        { key: "title", label: "Title", render: (row) => row.title },
        { key: "severity", label: "Severity", render: (row) => row.severity },
        { key: "decision", label: "Decision", render: (row) => <LCStatusBadge status={row.decision} /> },
        { key: "decisionNotes", label: "Notes", render: (row) => row.decisionNotes ?? "—" },
      ]}
    />
  );
}
