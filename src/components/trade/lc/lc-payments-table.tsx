"use client";

import { LCTable } from "@/components/trade/lc/lc-table";
import { LCStatusBadge } from "@/components/trade/lc/lc-status-badge";

type Payment = {
  id: string;
  paymentType: string;
  amount: number;
  currency: string;
  paymentDate: string | Date;
  status: string;
};

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function LCPaymentsTable({ rows }: { rows: Payment[] }) {
  return (
    <LCTable
      rows={rows}
      columns={[
        { key: "paymentType", label: "Type", render: (row) => row.paymentType },
        {
          key: "amount",
          label: "Amount",
          render: (row) => formatAmount(row.amount, row.currency),
        },
        {
          key: "paymentDate",
          label: "Date",
          render: (row) => new Date(row.paymentDate).toLocaleDateString(),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => <LCStatusBadge status={row.status} />,
        },
      ]}
    />
  );
}
