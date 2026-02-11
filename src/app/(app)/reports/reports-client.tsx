"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubNavTabs } from "@/components/ui/SubNavTabs";
import { FilterBar } from "@/components/filters/FilterBar";
import { FilterChips } from "@/components/filters/FilterChips";
import { FilterRail } from "@/components/filters/FilterRail";
import { DataGrid, DataGridColumn } from "@/components/datagrid/DataGrid";
import { ColumnVisibility } from "@/components/datagrid/ColumnVisibility";
import { RowActionsMenu } from "@/components/datagrid/RowActionsMenu";
import { formatMoney } from "@/lib/utils";

type SalesByCustomerRow = { customerName: string; count: number; totalCents: number };
type PurchasesByVendorRow = { vendorName: string; count: number; totalCents: number };
type AgedRow = { number: string; partyName: string; dueDate: string | null; totalCents: number; paidCents: number; dueCents: number };

interface ReportsClientProps {
  defaultFrom: string;
  defaultTo: string;
  salesTotalCents: number;
  purchasesTotalCents: number;
  paymentsInCents: number;
  paymentsOutCents: number;
  profitCents: number;
  incomeCents: number;
  expenseCents: number;
  salesByCustomer: SalesByCustomerRow[];
  purchasesByVendor: PurchasesByVendorRow[];
  agedReceivables: AgedRow[];
  agedPayables: AgedRow[];
}

const tabs = [
  { id: "sales", label: "Sales" },
  { id: "purchases", label: "Purchases" },
  { id: "pl", label: "P&L" },
  { id: "ar", label: "Aged AR" },
  { id: "ap", label: "Aged AP" },
];

const kpiCard = "surface-2 p-3";

export function ReportsClient(props: ReportsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tab, setTab] = useState("sales");
  const [range, setRange] = useState({ from: props.defaultFrom, to: props.defaultTo });
  const [railOpen, setRailOpen] = useState(false);
  const [customerSegment, setCustomerSegment] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "totalCents", order: "desc" });
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    count: true,
    total: true,
    dueDate: true,
    paid: true,
    due: true,
  });

  const chips = useMemo(() => {
    const out: { key: string; label: string }[] = [{ key: "date", label: `${range.from} → ${range.to}` }];
    if (customerSegment) out.push({ key: "segment", label: `Segment: ${customerSegment}` });
    if (status) out.push({ key: "status", label: `Status: ${status}` });
    return out;
  }, [range.from, range.to, customerSegment, status]);

  const applyRange = (next: { from: string; to: string }) => {
    setRange(next);
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set("from", next.from);
    nextParams.set("to", next.to);
    router.replace(`${pathname}?${nextParams.toString()}`);
  };

  const resetFilters = () => {
    setCustomerSegment("");
    setStatus("");
    applyRange({ from: props.defaultFrom, to: props.defaultTo });
  };

  const removeChip = (key: string) => {
    if (key === "segment") setCustomerSegment("");
    if (key === "status") setStatus("");
  };

  const kpis = [
    { label: "Sales", value: formatMoney(props.salesTotalCents) },
    { label: "Purchases", value: formatMoney(props.purchasesTotalCents) },
    { label: "Incoming", value: formatMoney(props.paymentsInCents) },
    { label: "Outgoing", value: formatMoney(props.paymentsOutCents) },
  ];

  const salesRows = [...props.salesByCustomer].sort((a, b) =>
    sort.order === "asc" ? a.totalCents - b.totalCents : b.totalCents - a.totalCents,
  );
  const purchaseRows = [...props.purchasesByVendor].sort((a, b) =>
    sort.order === "asc" ? a.totalCents - b.totalCents : b.totalCents - a.totalCents,
  );

  const salesColumns: DataGridColumn<SalesByCustomerRow>[] = [
    { key: "name", header: "Customer", sortable: true, render: (row) => row.customerName, className: visibleColumns.name ? "" : "hidden" },
    { key: "count", header: "Invoices", sortable: true, render: (row) => row.count, className: visibleColumns.count ? "" : "hidden" },
    { key: "totalCents", header: "Total", sortable: true, render: (row) => formatMoney(row.totalCents), className: visibleColumns.total ? "" : "hidden" },
    { key: "actions", header: "", render: () => <RowActionsMenu actions={[{ label: "View details", onSelect: () => undefined }]} /> },
  ];

  const purchaseColumns: DataGridColumn<PurchasesByVendorRow>[] = [
    { key: "name", header: "Vendor", sortable: true, render: (row) => row.vendorName, className: visibleColumns.name ? "" : "hidden" },
    { key: "count", header: "Bills", sortable: true, render: (row) => row.count, className: visibleColumns.count ? "" : "hidden" },
    { key: "totalCents", header: "Total", sortable: true, render: (row) => formatMoney(row.totalCents), className: visibleColumns.total ? "" : "hidden" },
    { key: "actions", header: "", render: () => <RowActionsMenu actions={[{ label: "Open vendor", onSelect: () => undefined }]} /> },
  ];

  const agedColumns: DataGridColumn<AgedRow>[] = [
    { key: "name", header: "Reference", render: (row) => <span className="font-mono text-xs">{row.number}</span>, className: visibleColumns.name ? "" : "hidden" },
    { key: "party", header: "Party", render: (row) => row.partyName, className: visibleColumns.count ? "" : "hidden" },
    { key: "dueDate", header: "Due Date", render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"), className: visibleColumns.dueDate ? "" : "hidden" },
    { key: "paid", header: "Paid", render: (row) => formatMoney(row.paidCents), className: visibleColumns.paid ? "" : "hidden" },
    { key: "due", header: "Due", sortable: true, render: (row) => <span className="font-medium">{formatMoney(row.dueCents)}</span>, className: visibleColumns.due ? "" : "hidden" },
  ];

  const columnToggles = [
    { key: "name", label: "Name", visible: visibleColumns.name },
    { key: "count", label: "Count", visible: visibleColumns.count },
    { key: "total", label: "Total", visible: visibleColumns.total },
    { key: "dueDate", label: "Due date", visible: visibleColumns.dueDate },
    { key: "paid", label: "Paid", visible: visibleColumns.paid },
    { key: "due", label: "Due", visible: visibleColumns.due },
  ];

  const gridRightSlot = (
    <ColumnVisibility
      columns={columnToggles}
      onToggle={(key) => setVisibleColumns((current) => ({ ...current, [key]: !current[key] }))}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Workbench reports with operational filters and export actions."
        actions={(
          <>
            <Button variant="outline" size="sm"><Share2 className="mr-1 h-4 w-4" /> Share</Button>
            <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
          </>
        )}
      />

      <SubNavTabs tabs={tabs} value={tab} onChange={setTab} />

      <FilterBar range={range} onChange={applyRange} onOpenMoreFilters={() => setRailOpen(true)} onReset={resetFilters} />
      <FilterChips chips={chips} onRemove={removeChip} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={kpiCard}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 text-lg font-semibold">{kpi.value}</div>
          </div>
        ))}
      </div>

      {tab === "sales" && (
        <DataGrid
          title="Sales summary"
          description="Top customers by billed revenue"
          columns={salesColumns}
          rows={salesRows}
          rowKey={(row) => row.customerName}
          emptyTitle="No sales data"
          emptyDescription="Create your first invoice to start generating sales reports."
          emptyAction={<Button asChild size="sm"><Link href="/invoices">Create invoice</Link></Button>}
          sortKey={sort.key}
          sortOrder={sort.order}
          onSort={(key) => setSort((s) => ({ key, order: s.order === "asc" ? "desc" : "asc" }))}
          rightSlot={gridRightSlot}
        />
      )}

      {tab === "purchases" && (
        <DataGrid
          title="Purchases summary"
          description="Top vendors by bill volume"
          columns={purchaseColumns}
          rows={purchaseRows}
          rowKey={(row) => row.vendorName}
          emptyTitle="No purchase data"
          emptyDescription="Create bills to populate this report."
          sortKey={sort.key}
          sortOrder={sort.order}
          onSort={(key) => setSort((s) => ({ key, order: s.order === "asc" ? "desc" : "asc" }))}
          rightSlot={gridRightSlot}
        />
      )}

      {tab === "pl" && (
        <section className="surface-1 p-4">
          <h3 className="text-sm font-semibold">Profit &amp; Loss</h3>
          <div className="mt-3 grid max-w-md gap-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Income</span><span>{formatMoney(props.incomeCents)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span>{formatMoney(props.expenseCents)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Profit</span><span>{formatMoney(props.profitCents)}</span></div>
          </div>
        </section>
      )}

      {tab === "ar" && (
        <DataGrid
          title="Aged receivables"
          columns={agedColumns}
          rows={props.agedReceivables}
          rowKey={(row) => `${row.number}-${row.partyName}`}
          emptyTitle="No outstanding receivables"
          emptyDescription="All invoices are paid for the selected period."
          rightSlot={gridRightSlot}
        />
      )}

      {tab === "ap" && (
        <DataGrid
          title="Aged payables"
          columns={agedColumns}
          rows={props.agedPayables}
          rowKey={(row) => `${row.number}-${row.partyName}`}
          emptyTitle="No outstanding payables"
          emptyDescription="No unpaid bills in this period."
          rightSlot={gridRightSlot}
        />
      )}

      <FilterRail
        open={railOpen}
        onOpenChange={setRailOpen}
        customerSegment={customerSegment}
        onCustomerSegmentChange={setCustomerSegment}
        status={status}
        onStatusChange={setStatus}
      />
    </div>
  );
}
