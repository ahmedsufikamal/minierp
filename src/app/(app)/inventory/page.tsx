import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Box, FileText, History, Package, Settings2, Warehouse } from "lucide-react";
import PageHeader from "@/components/page-header";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";

export const dynamic = "force-dynamic";

const cards = [
  {
    href: "/inventory/items",
    title: "Items",
    description: "Product master with custom fields and identifiers.",
    icon: Package,
  },
  {
    href: "/inventory/warehouses",
    title: "Warehouses",
    description: "Manage multi-warehouse and nested locations.",
    icon: Warehouse,
  },
  {
    href: "/inventory/documents",
    title: "Documents",
    description: "Receipts, issues, transfers, adjustments, counts.",
    icon: FileText,
  },
  {
    href: "/inventory/ledger",
    title: "Ledger",
    description: "Immutable stock ledger and balance trail.",
    icon: History,
  },
  {
    href: "/inventory/reorder",
    title: "Reorder",
    description: "Rule-based replenishment suggestions.",
    icon: Box,
  },
  {
    href: "/inventory/settings",
    title: "Settings",
    description: "Custom fields, workflows, and labels.",
    icon: Settings2,
  },
] as const;

type InventoryOverviewData = {
  counters: {
    items: number;
    documents: number;
    warehouses: number;
    openDocuments: number;
    reorderRules: number;
  };
  overview: {
    onHandByWarehouse: Array<{
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      onHand: number;
      reserved: number;
    }>;
    lowStock: Array<{
      itemId: string;
      sku: string;
      itemName: string;
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      onHand: number;
      reserved: number;
      threshold: number;
    }>;
    recentMovements: Array<{
      id: string;
      postingTime: string;
      itemId: string;
      sku: string;
      itemName: string;
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      quantityDelta: number;
      qtyIn: number;
      qtyOut: number;
    }>;
    topMovers: Array<{
      itemId: string;
      sku: string;
      itemName: string;
      netDelta: number;
      movementMagnitude: number;
    }>;
  };
};

async function fetchInventoryOverview(requestId: string): Promise<InventoryOverviewData | null> {
  const headerStore = await headers();
  const cookieStore = await cookies();

  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3000";
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${encodeURIComponent(entry.value)}`)
    .join("; ");

  const response = await fetch(`${protocol}://${host}/api/v1/inventory`, {
    method: "GET",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      "x-request-id": requestId,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; data?: InventoryOverviewData }
    | null;
  if (!body?.ok || !body.data) return null;
  return body.data;
}

export default async function InventoryHomePage() {
  const ctx = await getInventoryPageContext(inventoryPermissions.itemRead);
  const overview = await fetchInventoryOverview(ctx.requestId);
  const counters = overview?.counters ?? {
    items: 0,
    documents: 0,
    warehouses: 0,
    openDocuments: 0,
    reorderRules: 0,
  };
  const lowStock = overview?.overview.lowStock ?? [];
  const recentMovements = overview?.overview.recentMovements ?? [];
  const topMovers = overview?.overview.topMovers ?? [];
  const onHandByWarehouse = overview?.overview.onHandByWarehouse ?? [];
  const needsMigration = overview === null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        subtitle="Production-ready inventory workspace with configurable fields, workflows, and stock posting."
      />

      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-medium text-amber-900">Database Migration Required</div>
          <p className="mt-1 text-sm text-amber-700">
            Inventory overview projection could not be loaded. Verify migrations and inventory API health:
          </p>
          <code className="mt-2 block rounded bg-amber-100 p-2 text-xs text-amber-900">
            npx prisma migrate status{"\n"}npm run prisma:migrate:deploy
          </code>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Items</p><p className="text-2xl font-semibold">{counters.items}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Warehouses</p><p className="text-2xl font-semibold">{counters.warehouses}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Documents</p><p className="text-2xl font-semibold">{counters.documents}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Open Documents</p><p className="text-2xl font-semibold">{counters.openDocuments}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Reorder Rules</p><p className="text-2xl font-semibold">{counters.reorderRules}</p></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="surface-1 overflow-hidden">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Low Stock Watch</div>
          <div className="overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">On Hand</th>
                  <th className="px-3 py-2">Threshold</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((row) => (
                  <tr key={`${row.itemId}:${row.warehouseId}`} className="border-t border-border">
                    <td className="px-3 py-2">{row.sku}</td>
                    <td className="px-3 py-2">{row.warehouseCode}</td>
                    <td className="px-3 py-2">{row.onHand}</td>
                    <td className="px-3 py-2">{row.threshold}</td>
                  </tr>
                ))}
                {lowStock.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      No low-stock alerts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-1 overflow-hidden">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Top Movers (30d)</div>
          <div className="overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Net Delta</th>
                  <th className="px-3 py-2">Movement Magnitude</th>
                </tr>
              </thead>
              <tbody>
                {topMovers.map((row) => (
                  <tr key={row.itemId} className="border-t border-border">
                    <td className="px-3 py-2">{row.sku}</td>
                    <td className="px-3 py-2">{row.netDelta}</td>
                    <td className="px-3 py-2">{row.movementMagnitude}</td>
                  </tr>
                ))}
                {topMovers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No movement data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="surface-1 overflow-hidden">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">Recent Movements</div>
          <div className="overflow-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">Qty In</th>
                  <th className="px-3 py-2">Qty Out</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">{new Date(row.postingTime).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.sku}</td>
                    <td className="px-3 py-2">{row.warehouseCode}</td>
                    <td className="px-3 py-2">{row.qtyIn}</td>
                    <td className="px-3 py-2">{row.qtyOut}</td>
                  </tr>
                ))}
                {recentMovements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No movement history yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-1 overflow-hidden">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">On Hand by Warehouse</div>
          <div className="overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-[hsl(var(--surface-2))] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Warehouse</th>
                  <th className="px-3 py-2">On Hand</th>
                  <th className="px-3 py-2">Reserved</th>
                </tr>
              </thead>
              <tbody>
                {onHandByWarehouse.map((row) => (
                  <tr key={row.warehouseId} className="border-t border-border">
                    <td className="px-3 py-2">{row.warehouseCode}</td>
                    <td className="px-3 py-2">{row.onHand}</td>
                    <td className="px-3 py-2">{row.reserved}</td>
                  </tr>
                ))}
                {onHandByWarehouse.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      No stock balances available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="surface-1 block p-4 hover:bg-[hsl(var(--surface-2))]">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{card.title}</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
