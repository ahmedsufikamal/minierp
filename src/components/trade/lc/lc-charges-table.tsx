"use client";

import { LCTable } from "@/components/trade/lc/lc-table";

type Charge = {
  id: string;
  chargeTypeCode: string;
  amount: number;
  currency: string;
  chargedBy: string;
  chargeDate: string | Date;
};

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function LCChargesTable({ rows }: { rows: Charge[] }) {
  return (
    <LCTable
      rows={rows}
      columns={[
        { key: "chargeTypeCode", label: "Charge", render: (row) => row.chargeTypeCode },
        { key: "chargedBy", label: "By", render: (row) => row.chargedBy },
        { key: "amount", label: "Amount", render: (row) => formatAmount(row.amount, row.currency) },
        {
          key: "chargeDate",
          label: "Date",
          render: (row) => new Date(row.chargeDate).toLocaleDateString(),
        },
      ]}
    />
  );
}
