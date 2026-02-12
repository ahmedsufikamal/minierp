import Link from "next/link";
import { Box, FileText, History, Package, Settings2, Warehouse } from "lucide-react";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";

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

function isMissingSchemaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return e?.code === "P2021" || e?.code === "P2022" || Boolean(e?.message?.includes("does not exist"));
}

export default async function InventoryHomePage() {
  const companyId = await getCompanyIdOrUserId();
  const countWithFallback = async (promise: Promise<number>): Promise<{ count: number; needsMigration: boolean }> => {
    try {
      return { count: await promise, needsMigration: false };
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return { count: 0, needsMigration: true };
      }
      throw error;
    }
  };

  const [itemsResult, warehousesResult, docsResult, openDocsResult, pendingReorderResult] = await Promise.all([
    countWithFallback(prisma.product.count({ where: { companyId } })),
    countWithFallback(prisma.inventoryWarehouse.count({ where: { companyId, isActive: true } })),
    countWithFallback(prisma.inventoryDocument.count({ where: { companyId } })),
    countWithFallback(prisma.inventoryDocument.count({ where: { companyId, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } })),
    countWithFallback(prisma.inventoryReorderRule.count({ where: { companyId, isActive: true } })),
  ]);
  const items = itemsResult.count;
  const warehouses = warehousesResult.count;
  const docs = docsResult.count;
  const openDocs = openDocsResult.count;
  const pendingReorder = pendingReorderResult.count;
  const needsMigration =
    itemsResult.needsMigration ||
    warehousesResult.needsMigration ||
    docsResult.needsMigration ||
    openDocsResult.needsMigration ||
    pendingReorderResult.needsMigration;

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
            Inventory tables are missing in the current database. Run migrations before using inventory features:
          </p>
          <code className="mt-2 block rounded bg-amber-100 p-2 text-xs text-amber-900">
            npm run prisma:migrate:dev{"\n"}npm run prisma:generate
          </code>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Items</p><p className="text-2xl font-semibold">{items}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Warehouses</p><p className="text-2xl font-semibold">{warehouses}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Documents</p><p className="text-2xl font-semibold">{docs}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Open Documents</p><p className="text-2xl font-semibold">{openDocs}</p></div>
        <div className="surface-1 p-3"><p className="text-xs text-muted-foreground">Reorder Rules</p><p className="text-2xl font-semibold">{pendingReorder}</p></div>
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
