import { InventoryCustomFieldEntityType, InventoryPresetScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getCompanyIdOrUserId } from "@/lib/auth";
import PageHeader from "@/components/page-header";
import { InventoryItemsWorkbench } from "./items-workbench";

export const dynamic = "force-dynamic";

function isMissingSchemaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return e?.code === "P2021" || e?.code === "P2022" || Boolean(e?.message?.includes("does not exist"));
}

export default async function InventoryItemsPage() {
  const companyId = await getCompanyIdOrUserId();
  const user = await getCurrentUser();
  let needsMigration = false;

  const withMissingSchemaFallback = async <T,>(promise: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await promise;
    } catch (error) {
      if (isMissingSchemaError(error)) {
        needsMigration = true;
        return fallback;
      }
      throw error;
    }
  };

  const [items, customDefs, customValues, presets] = await Promise.all([
    withMissingSchemaFallback(
      prisma.product.findMany({
        where: { companyId },
        include: {
          brand: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      [],
    ),
    withMissingSchemaFallback(
      prisma.inventoryCustomFieldDefinition.findMany({
        where: {
          companyId,
          entityType: InventoryCustomFieldEntityType.ITEM,
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      [],
    ),
    withMissingSchemaFallback(
      prisma.inventoryCustomFieldValue.findMany({
        where: {
          companyId,
          entityType: InventoryCustomFieldEntityType.ITEM,
        },
        include: {
          fieldDefinition: {
            select: { key: true },
          },
        },
      }),
      [],
    ),
    withMissingSchemaFallback(
      prisma.inventoryViewPreset.findMany({
        where: {
          companyId,
          entity: "ITEMS",
          OR: [
            { scope: InventoryPresetScope.COMPANY },
            ...(user?.role ? [{ scope: InventoryPresetScope.ROLE, role: user.role }] : []),
            ...(user?.id ? [{ scope: InventoryPresetScope.USER, ownerUserId: user.id }] : []),
          ],
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      }),
      [],
    ),
  ]);

  const customByEntity: Record<string, Record<string, unknown>> = {};
  for (const row of customValues) {
    if (!customByEntity[row.entityId]) customByEntity[row.entityId] = {};
    customByEntity[row.entityId][row.fieldDefinition.key] = row.value;
  }

  const rows = items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    uom: item.uom,
    unitCostMinor: item.unitCostMinor,
    isActive: item.isActive,
    brand: item.brand,
    customFields: customByEntity[item.id] ?? {},
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Items"
        subtitle="Customizable item list with dynamic columns and saved views."
      />

      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-medium text-amber-900">Database Migration Required</div>
          <p className="mt-1 text-sm text-amber-700">
            Inventory custom-field tables are missing in the current database. Run migrations before using dynamic
            inventory settings:
          </p>
          <code className="mt-2 block rounded bg-amber-100 p-2 text-xs text-amber-900">
            npm run prisma:migrate:dev{"\n"}npm run prisma:generate
          </code>
        </div>
      )}

      <InventoryItemsWorkbench
        rows={rows}
        customFieldDefs={customDefs.map((field) => ({
          id: field.id,
          key: field.key,
          label: field.label,
          showInList: field.showInList,
        }))}
        presets={presets.map((preset) => ({
          id: preset.id,
          name: preset.name,
          config: (preset.config as { columns?: string[]; search?: string } | null) ?? {},
        }))}
      />
    </div>
  );
}
