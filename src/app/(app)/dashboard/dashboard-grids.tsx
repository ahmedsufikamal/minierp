"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataGrid, DataGridColumn } from "@/components/datagrid/DataGrid";
import { formatMoney } from "@/lib/utils";

export type DashboardOverdueInvoiceRow = {
  id: string;
  number: string;
  customerName: string;
  dueDate: string | null;
  amountDueCents: number;
};

export type DashboardLowStockRow = {
  id: string;
  name: string;
  sku: string;
  qty: number;
  threshold: number;
};

interface DashboardGridsProps {
  overdueInvoices: DashboardOverdueInvoiceRow[];
  lowStockRows: DashboardLowStockRow[];
}

export function DashboardGrids({ overdueInvoices, lowStockRows }: DashboardGridsProps) {
  const invoiceColumns: DataGridColumn<DashboardOverdueInvoiceRow>[] = [
    { key: "number", header: "Invoice", render: (row) => <span className="font-mono text-xs">{row.number}</span> },
    { key: "customer", header: "Customer", render: (row) => row.customerName },
    { key: "dueDate", header: "Due Date", render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—") },
    { key: "amount", header: "Amount Due", render: (row) => <span className="font-medium">{formatMoney(row.amountDueCents)}</span> },
    { key: "action", header: "", render: () => <Link href="/invoices" className="text-xs text-primary hover:underline">Open</Link> },
  ];

  const lowStockColumns: DataGridColumn<DashboardLowStockRow>[] = [
    { key: "name", header: "Product", render: (row) => row.name },
    { key: "sku", header: "SKU", render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    { key: "qty", header: "On Hand", render: (row) => row.qty },
    { key: "threshold", header: "Threshold", render: (row) => row.threshold },
    { key: "action", header: "", render: () => <Link href="/products" className="text-xs text-primary hover:underline">Replenish</Link> },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DataGrid
        title="Overdue invoices"
        description="Outstanding receivables requiring follow-up"
        columns={invoiceColumns}
        rows={overdueInvoices}
        rowKey={(row) => row.id}
        emptyTitle="No overdue invoices"
        emptyDescription="Great! Your receivables are up to date."
        emptyAction={<Button asChild size="sm"><Link href="/invoices">View invoices</Link></Button>}
      />

      <DataGrid
        title="Low stock watch"
        description="Items below configured thresholds"
        columns={lowStockColumns}
        rows={lowStockRows}
        rowKey={(row) => row.id}
        emptyTitle="No low-stock items"
        emptyDescription="Inventory levels are healthy."
        emptyAction={<Button asChild size="sm"><Link href="/inventory">Open inventory</Link></Button>}
      />
    </div>
  );
}
