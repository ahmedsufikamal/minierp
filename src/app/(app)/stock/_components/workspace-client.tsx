"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard } from "@/components/stock-home/kpi-card";
import { LinkGroupCard } from "@/components/stock-home/link-group-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  { href: "/stock/items", label: "Items Available", key: "items_available" as const },
  { href: "/selling/delivery-notes", label: "Delivery Notes To Bill", key: "delivery_note_to_bill" as const },
  { href: "/buying/material-requests", label: "Material Requests Pending", key: "material_request_pending" as const },
  { href: "/buying/purchase-receipts", label: "Receipts To Bill", key: "purchase_receipt_to_bill" as const },
] as const;

const mastersAndReports = [
  {
    title: "Items Catalogue",
    links: [
      { href: "/stock/items", label: "Item" },
      { href: "/setup/item-groups", label: "Item Group" },
      { href: "/stock/items", label: "Product Bundle" },
      { href: "/products", label: "Brand" },
      { href: "/stock/items", label: "Item Alternative" },
      { href: "/stock/items", label: "Item Manufacturer" },
    ],
  },
  {
    title: "Stock Transactions",
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
    title: "Stock Reports",
    links: [
      { href: "/stock/ledger", label: "Stock Ledger" },
      { href: "/reports/stock-balance", label: "Stock Balance" },
      { href: "/reports/stock-summary", label: "Stock Summary" },
      { href: "/reports/stock-ageing", label: "Stock Ageing" },
      { href: "/reports/warehouse-wise-stock-balance", label: "Warehouse Wise Stock Balance" },
    ],
  },
  {
    title: "Setup",
    links: [
      { href: "/stock/settings", label: "Stock Settings" },
      { href: "/stock/warehouses", label: "Warehouse" },
      { href: "/setup/uoms", label: "Unit of Measure (UOM)" },
      { href: "/stock/settings", label: "Item Variant Settings" },
      { href: "/products", label: "Brand" },
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
        label: "Total Stock Value",
        value: formatMoney(metrics.total_stock_value.amount, metrics.total_stock_value.currency),
        hint: "Current on-hand value across active warehouses.",
      },
      { label: "Total Warehouses", value: String(metrics.total_warehouses), hint: "Warehouses available for stock movement." },
      { label: "Total Active Items", value: String(metrics.total_active_items), hint: "Enabled items in the catalogue." },
    ],
    [metrics],
  );

  return (
    <div className="space-y-5">
      <Card className="rounded-[28px] border border-border shadow-sm">
        <CardContent className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr),300px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Warehouse wise Stock Value</p>
                <p className="text-sm text-muted-foreground">{lastSyncedText(series.last_synced_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-[hsl(var(--surface-2))] text-muted-foreground" type="button">
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-[hsl(var(--surface-2))] text-muted-foreground" type="button">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
            {loading ? (
              <div className="h-[320px] animate-pulse rounded-2xl border border-dashed border-border bg-[hsl(var(--surface-2))]" />
            ) : hasChartData ? (
              <div className="h-[320px] w-full rounded-2xl bg-[hsl(var(--surface-2))] p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series.series.map((row) => ({ name: row.warehouse_name, value: row.stock_value.amount }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--text-muted))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--text-muted))", fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value ?? 0), chartCurrency)}
                      contentStyle={{
                        borderRadius: 16,
                        borderColor: "hsl(var(--border))",
                        backgroundColor: "hsl(var(--popover))",
                        color: "hsl(var(--popover-foreground))",
                      }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {series.series.map((entry) => (
                        <Cell key={entry.warehouse_id} fill="hsl(var(--primary))" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-border bg-[hsl(var(--surface-2))] text-sm text-muted-foreground">
                No warehouse stock value data available.
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-3xl border border-border bg-[hsl(var(--surface-2))] p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Operational Snapshot</p>
            </div>
            <div className="space-y-2">
              {quickAccessConfig.map((entry) => (
                <Link key={entry.href + entry.label} href={entry.href} className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-3 text-sm transition-colors hover:bg-[hsl(var(--surface-1))]">
                  <span className="font-medium text-foreground">{entry.label}</span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{quickAccess[entry.key]}</span>
                </Link>
              ))}
            </div>
            {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        {topCards.map((card) => (
          <KpiCard key={card.label} label={card.label} value={loading ? "..." : card.value} hint={card.hint} />
        ))}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Masters & Reports</h2>
          <p className="text-sm text-muted-foreground">Core masters, transactional shortcuts, and stock reporting views.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {mastersAndReports.map((section) => (
            <LinkGroupCard key={section.title} title={section.title} links={[...section.links]} />
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
