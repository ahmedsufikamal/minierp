"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

type MetricsDto = {
  total_stock_value: { amount: number; currency: string };
  total_warehouses: number;
  total_active_items: number;
  last_synced_at: string;
};

type WarehouseSeriesDto = {
  last_synced_at: string;
  series: Array<{
    warehouse_id: string;
    warehouse_name: string;
    stock_value: { amount: number; currency: string };
  }>;
};

type QuickAccessDto = {
  items_available: number;
  delivery_note_to_bill: number;
  material_request_pending: number;
  purchase_receipt_to_bill: number;
};

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string; details?: unknown } };

const fallbackMetrics: MetricsDto = {
  total_stock_value: { amount: 0, currency: "BDT" },
  total_warehouses: 0,
  total_active_items: 0,
  last_synced_at: new Date().toISOString(),
};

const fallbackQuickAccess: QuickAccessDto = {
  items_available: 0,
  delivery_note_to_bill: 0,
  material_request_pending: 0,
  purchase_receipt_to_bill: 0,
};

const quickAccessConfig = [
  { href: "/stock/items", label: "Item", key: "items_available" as const, suffix: "Available" },
  { href: "/selling/delivery-notes", label: "Delivery Note", key: "delivery_note_to_bill" as const, suffix: "To Bill" },
  { href: "/buying/material-requests", label: "Material Request", key: "material_request_pending" as const, suffix: "Pending" },
  { href: "/buying/purchase-receipts", label: "Purchase Receipt", key: "purchase_receipt_to_bill" as const, suffix: "To Bill" },
  { href: "/stock/ledger", label: "Stock Ledger", key: null, suffix: null },
  { href: "/reports/stock-balance", label: "Stock Balance", key: null, suffix: null },
] as const;

const mastersAndReports = [
  {
    group: "Items Catalogue",
    links: [
      { href: "/stock/items", label: "Item" },
      { href: "/setup/item-groups", label: "Item Group" },
      { href: "/stock/items", label: "Product Bundle" },
      { href: "/stock/items", label: "Shipping Rule" },
      { href: "/stock/items", label: "Item Alternative" },
      { href: "/stock/items", label: "Item Manufacturer" },
    ],
  },
  {
    group: "Stock Transactions",
    links: [
      { href: "/buying/material-requests", label: "Material Request" },
      { href: "/stock/documents", label: "Stock Entry" },
      { href: "/selling/delivery-notes", label: "Delivery Note" },
      { href: "/buying/purchase-receipts", label: "Purchase Receipt" },
      { href: "/stock/documents", label: "Pick List" },
      { href: "/stock/documents", label: "Delivery Trip" },
    ],
  },
  {
    group: "Stock Reports",
    links: [
      { href: "/stock/ledger", label: "Stock Ledger" },
      { href: "/reports/stock-balance", label: "Stock Balance" },
      { href: "/reports/stock-projected-qty", label: "Stock Projected Qty" },
      { href: "/reports/stock-summary", label: "Stock Summary" },
      { href: "/reports/stock-ageing", label: "Stock Ageing" },
      { href: "/reports/item-price-stock", label: "Item Price Stock" },
      { href: "/reports/warehouse-wise-stock-balance", label: "Warehouse Wise Stock Balance" },
    ],
  },
  {
    group: "Settings",
    links: [
      { href: "/stock/settings", label: "Stock Settings" },
      { href: "/stock/warehouses", label: "Warehouse" },
      { href: "/setup/uoms", label: "Unit of Measure (UOM)" },
      { href: "/stock/settings", label: "Item Variant Settings" },
      { href: "/products", label: "Brand" },
      { href: "/stock/settings", label: "Item Attribute" },
    ],
  },
  {
    group: "Serial No and Batch",
    links: [
      { href: "/stock/items", label: "Serial No" },
      { href: "/stock/items", label: "Batch" },
      { href: "/stock/items", label: "Installation Note" },
      { href: "/stock/items", label: "Serial No Service Contract Expiry" },
      { href: "/stock/items", label: "Serial No Status" },
      { href: "/stock/items", label: "Serial No Warranty Expiry" },
    ],
  },
  {
    group: "Tools",
    links: [
      { href: "/stock/documents", label: "Packing Slip" },
      { href: "/quality/inspections", label: "Quality Inspection Template" },
      { href: "/stock", label: "Quick Stock Balance" },
    ],
  },
  {
    group: "Key Reports",
    links: [
      { href: "/stock/ledger", label: "Stock Ledger Summary" },
      { href: "/reports/stock-voucher", label: "Stock Voucher" },
      { href: "/reports/item-shortage", label: "Item Shortage" },
    ],
  },
  {
    group: "Other Reports",
    links: [
      { href: "/reports/available-batch", label: "Available Batch Report" },
      { href: "/reports/stock-ledger-invariant", label: "Ledger Invariant Report" },
      { href: "/reports/warehouse-utilization", label: "Warehouse Utilization" },
    ],
  },
] as const;

function lastSyncedText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last synced recently";
  return `Last synced ${date.toLocaleString()}`;
}

export function StockWorkspaceClient() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricsDto>(fallbackMetrics);
  const [series, setSeries] = useState<WarehouseSeriesDto>({ last_synced_at: new Date().toISOString(), series: [] });
  const [quickAccess, setQuickAccess] = useState<QuickAccessDto>(fallbackQuickAccess);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [metricsRes, chartRes, quickRes] = await Promise.all([
          fetch("/api/stock/workspace/metrics", { cache: "no-store" }),
          fetch("/api/stock/workspace/warehouse-stock-value", { cache: "no-store" }),
          fetch("/api/stock/workspace/quick-access", { cache: "no-store" }),
        ]);

        const metricsBody = (await metricsRes.json().catch(() => null)) as Envelope<MetricsDto> | null;
        const chartBody = (await chartRes.json().catch(() => null)) as Envelope<WarehouseSeriesDto> | null;
        const quickBody = (await quickRes.json().catch(() => null)) as Envelope<QuickAccessDto> | null;

        if (!alive) return;

        if (!metricsRes.ok || !metricsBody?.ok) {
          throw new Error(metricsBody && !metricsBody.ok ? (metricsBody.error?.message ?? "Failed to load metrics") : "Failed to load metrics");
        }

        setMetrics(metricsBody.data);
        setSeries(chartRes.ok && chartBody?.ok ? chartBody.data : { last_synced_at: metricsBody.data.last_synced_at, series: [] });
        setQuickAccess(quickRes.ok && quickBody?.ok ? quickBody.data : fallbackQuickAccess);
      } catch (loadError) {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load stock workspace");
        setMetrics(fallbackMetrics);
        setSeries({ last_synced_at: new Date().toISOString(), series: [] });
        setQuickAccess(fallbackQuickAccess);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const hasChartData = series.series.length > 0;
  const chartCurrency = series.series[0]?.stock_value.currency ?? metrics.total_stock_value.currency;

  const topCards = useMemo(
    () => [
      {
        title: "Total Stock Value",
        value: formatMoney(metrics.total_stock_value.amount, metrics.total_stock_value.currency),
        delta: "0.0% since yesterday",
      },
      { title: "Total Warehouses", value: String(metrics.total_warehouses), delta: "All active warehouses" },
      { title: "Total Active Items", value: String(metrics.total_active_items), delta: "Enabled catalogue items" },
    ],
    [metrics],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {topCards.map((card) => (
          <article key={card.title} className="surface-1 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.title}</p>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground" type="button">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            {loading ? (
              <div className="h-8 w-2/3 animate-pulse rounded bg-[hsl(var(--surface-3))]" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{card.delta}</p>
          </article>
        ))}
      </div>

      <section className="surface-1 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Warehouse wise Stock Value</h2>
            <p className="text-xs text-muted-foreground">{lastSyncedText(series.last_synced_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground" type="button">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground" type="button">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="h-[280px] animate-pulse rounded-md border border-dashed border-border bg-[hsl(var(--surface-2))]" />
        ) : hasChartData ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.series.map((row) => ({ name: row.warehouse_name, value: row.stock_value.amount }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--text-muted))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--text-muted))", fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value ?? 0), chartCurrency)}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "hsl(var(--border))",
                    backgroundColor: "hsl(var(--surface-overlay))",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {series.series.map((entry) => (
                    <Cell key={entry.warehouse_id} fill="hsl(var(--primary))" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
            No warehouse stock value data available.
          </div>
        )}
      </section>

      <section className="surface-1 p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Quick Access</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {quickAccessConfig.map((entry) => (
            <Link
              key={entry.href + entry.label}
              href={entry.href}
              className="rounded-md border border-border bg-[hsl(var(--surface-2))] px-3 py-2 text-sm transition hover:bg-[hsl(var(--surface-3))]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{entry.label}</span>
                {entry.key ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {quickAccess[entry.key]} {entry.suffix}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface-1 p-4">
        <h2 className="mb-3 text-base font-semibold">Masters & Reports</h2>
        {error ? <p className="mb-3 text-xs text-muted-foreground">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {mastersAndReports.map((section) => (
            <div key={section.group} className="rounded-md border border-border bg-[hsl(var(--surface-2))] p-3">
              <h3 className="mb-2 text-sm font-semibold">{section.group}</h3>
              <div className="space-y-1">
                {section.links.map((link) => (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    className="block text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function WorkspaceHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm">
        <Link href="/stock/items/new">+ Add Item</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/stock/settings">Stock Settings</Link>
      </Button>
    </div>
  );
}
