"use client";

import { LCTable } from "@/components/trade/lc/lc-table";

type DocLine = {
  id: string;
  documentTypeCode: string;
  required: boolean;
  received: boolean;
  referenceNo?: string | null;
  issueDate?: string | Date | null;
  notes?: string | null;
};

export function LCDocChecklist({ rows }: { rows: DocLine[] }) {
  return (
    <LCTable
      rows={rows}
      columns={[
        { key: "documentTypeCode", label: "Document", render: (row) => row.documentTypeCode },
        { key: "required", label: "Required", render: (row) => (row.required ? "Yes" : "No") },
        { key: "received", label: "Received", render: (row) => (row.received ? "Yes" : "No") },
        { key: "referenceNo", label: "Reference", render: (row) => row.referenceNo ?? "—" },
        {
          key: "notes",
          label: "Notes",
          render: (row) => row.notes ?? "—",
        },
      ]}
    />
  );
}
