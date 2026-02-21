import { InventoryCustomFieldEntityType } from "@prisma/client";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContext } from "@/modules/inventory/interface/page-context";
import { InventorySettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

function isMissingSchemaError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return (
    e?.code === "P2021" ||
    e?.code === "P2022" ||
    Boolean(e?.message?.includes("does not exist")) ||
    Boolean(e?.message?.includes("Unknown field")) ||
    Boolean(e?.message?.includes("for select statement on model `InventoryCompanySetting`"))
  );
}

export default async function InventorySettingsPage() {
  const ctx = await getInventoryPageContext(inventoryPermissions.settingsRead);
  const companyId = ctx.companyId;

  const [fields, workflows, labelTemplates] = await Promise.all([
    prisma.inventoryCustomFieldDefinition.findMany({
      where: {
        companyId,
        entityType: {
          in: [
            InventoryCustomFieldEntityType.ITEM,
            InventoryCustomFieldEntityType.WAREHOUSE,
            InventoryCustomFieldEntityType.LOCATION,
            InventoryCustomFieldEntityType.DOCUMENT,
            InventoryCustomFieldEntityType.DOCUMENT_LINE,
          ],
        },
      },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.inventoryWorkflowDefinition.findMany({
      where: { companyId },
      orderBy: [{ documentType: "asc" }, { version: "desc" }],
    }),
    prisma.inventoryLabelTemplate.findMany({
      where: { companyId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const warehouses = await prisma.inventoryWarehouse.findMany({
    where: { companyId, isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });

  const defaultCompanySetting = {
    defaultWarehouseId: null as string | null,
    documentSeriesCode: "INV-DOC",
    defaultUom: "pcs",
    costingMethod: "AVG",
    preventNegativeStock: true,
    allowNegativeOverride: false,
    trackByLocation: false,
    baseCurrency: "BDT",
  };
  const companySettingResult = await prisma.inventoryCompanySetting
    .findUnique({
      where: { companyId },
      select: {
        defaultWarehouseId: true,
        documentSeriesCode: true,
        defaultUom: true,
        costingMethod: true,
        preventNegativeStock: true,
        allowNegativeOverride: true,
        trackByLocation: true,
        baseCurrency: true,
      },
    })
    .then((setting) => ({
      companySetting: setting ?? defaultCompanySetting,
      needsMigration: false,
    }))
    .catch((error: unknown) => {
      if (isMissingSchemaError(error)) {
        return {
          companySetting: defaultCompanySetting,
          needsMigration: true,
        };
      }
      throw error;
    });
  const { companySetting, needsMigration } = companySettingResult;

  const valuationMethod = companySetting.costingMethod === "FIFO" ? "FIFO" : "MOVING_AVERAGE";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Settings"
        subtitle="Configure custom fields, workflows, and label templates without code changes."
      />

      {needsMigration && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-medium text-amber-900">Database Migration Required</div>
          <p className="mt-1 text-sm text-amber-700">
            Inventory settings schema/client is out of sync. Run migrations and regenerate Prisma client before
            updating inventory settings:
          </p>
          <code className="mt-2 block rounded bg-amber-100 p-2 text-xs text-amber-900">
            npm run prisma:migrate:dev{"\n"}npm run prisma:generate
          </code>
        </div>
      )}

      <InventorySettingsClient
        fields={fields.map((field) => ({
          id: field.id,
          entityType: field.entityType,
          key: field.key,
          label: field.label,
          fieldType: field.fieldType,
          required: field.required,
          showInList: field.showInList,
          isActive: field.isActive,
        }))}
        workflows={workflows.map((workflow) => ({
          id: workflow.id,
          documentType: workflow.documentType,
          name: workflow.name,
          version: workflow.version,
          isActive: workflow.isActive,
          config: workflow.config,
        }))}
        labelTemplates={labelTemplates.map((template) => ({
          id: template.id,
          name: template.name,
          paperType: template.paperType,
          isDefault: template.isDefault,
        }))}
        companySettings={{
          defaultWarehouseId: companySetting.defaultWarehouseId,
          documentSeriesCode: companySetting.documentSeriesCode ?? "INV-DOC",
          defaultUom: companySetting.defaultUom ?? "pcs",
          valuationMethod,
          preventNegativeStock: companySetting.preventNegativeStock,
          allowNegativeOverride: companySetting.allowNegativeOverride,
          trackByLocation: companySetting.trackByLocation,
          baseCurrency: companySetting.baseCurrency,
        }}
        warehouses={warehouses}
      />
    </div>
  );
}
