import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { WarehousesClient } from "./warehouses-client";

export const dynamic = "force-dynamic";

function isMissingSchemaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return (
    e?.code === "P2021" ||
    e?.code === "P2022" ||
    Boolean(e?.message?.includes("does not exist")) ||
    Boolean(e?.message?.includes("Unknown field")) ||
    Boolean(e?.message?.includes("for include statement on model `InventoryWarehouse`"))
  );
}

export default async function WarehousesPage() {
  const ctx = await getInventoryPageContext(inventoryPermissions.settingsRead);
  const companyId = ctx.companyId;
  const rowsResult = await prisma.inventoryWarehouse
    .findMany({
      where: { companyId },
      include: {
        parentWarehouse: {
          select: { id: true, code: true, name: true },
        },
        locations: {
          orderBy: [{ path: "asc" }, { code: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    })
    .then((rows) => ({ rows, needsMigration: false }))
    .catch((error: unknown) => {
      if (isMissingSchemaError(error)) {
        return { rows: [], needsMigration: true };
      }
      throw error;
    });
  const rows = rowsResult.rows;
  const needsMigration = rowsResult.needsMigration;

  return (
    <div className="space-y-4">
      <PageHeader title="Warehouses" subtitle="Manage warehouses and nested locations." />

      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-medium text-amber-900">Database Migration Required</div>
          <p className="mt-1 text-sm text-amber-700">
            Inventory warehouse schema/client is out of sync. Run migrations and regenerate Prisma client before managing warehouses:
          </p>
          <code className="mt-2 block rounded bg-amber-100 p-2 text-xs text-amber-900">
            npm run prisma:migrate:dev{"\n"}npm run prisma:generate
          </code>
        </div>
      )}

      <WarehousesClient
        rows={rows.map((warehouse) => ({
          id: warehouse.id,
          code: warehouse.code,
          name: warehouse.name,
          description: warehouse.description,
          parentWarehouse: warehouse.parentWarehouse
            ? {
                id: warehouse.parentWarehouse.id,
                code: warehouse.parentWarehouse.code,
                name: warehouse.parentWarehouse.name,
              }
            : null,
          address:
            warehouse.metadata &&
            typeof warehouse.metadata === "object" &&
            !Array.isArray(warehouse.metadata) &&
            typeof (warehouse.metadata as { address?: unknown }).address === "object" &&
            (warehouse.metadata as { address?: unknown }).address &&
            !Array.isArray((warehouse.metadata as { address?: unknown }).address)
              ? ((warehouse.metadata as { address: Record<string, unknown> }).address as Record<string, unknown>)
              : null,
          isActive: warehouse.isActive,
          locations: warehouse.locations.map((location) => ({
            id: location.id,
            code: location.code,
            name: location.name,
            isActive: location.isActive,
          })),
        }))}
      />
    </div>
  );
}
