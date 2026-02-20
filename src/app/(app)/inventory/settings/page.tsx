import { InventoryCustomFieldEntityType } from "@prisma/client";
import PageHeader from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getInventoryCompanyScopeId } from "@/modules/inventory/interface/company-scope";
import { InventorySettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function InventorySettingsPage() {
  const companyId = await getInventoryCompanyScopeId();

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

  const companySetting =
    (await prisma.inventoryCompanySetting.findUnique({
      where: { companyId },
      select: {
        costingMethod: true,
        preventNegativeStock: true,
        allowNegativeOverride: true,
        trackByLocation: true,
        baseCurrency: true,
      },
    })) ?? {
      costingMethod: "AVG",
      preventNegativeStock: true,
      allowNegativeOverride: false,
      trackByLocation: false,
      baseCurrency: "BDT",
    };

  const valuationMethod = companySetting.costingMethod === "FIFO" ? "FIFO" : "MOVING_AVERAGE";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory Settings"
        subtitle="Configure custom fields, workflows, and label templates without code changes."
      />

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
          valuationMethod,
          preventNegativeStock: companySetting.preventNegativeStock,
          allowNegativeOverride: companySetting.allowNegativeOverride,
          trackByLocation: companySetting.trackByLocation,
          baseCurrency: companySetting.baseCurrency,
        }}
      />
    </div>
  );
}
