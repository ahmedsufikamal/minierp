import { InventoryCustomFieldEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import PageHeader from "@/components/page-header";
import { NewInventoryItemForm } from "../new-item-form";

export const dynamic = "force-dynamic";

export default async function NewInventoryItemPage() {
  const companyId = await getCompanyIdOrUserId();

  const [brands, fields] = await Promise.all([
    prisma.brand.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.inventoryCustomFieldDefinition.findMany({
      where: {
        companyId,
        entityType: InventoryCustomFieldEntityType.ITEM,
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Inventory Item"
        subtitle="Create an inventory item with dynamic custom fields configured by your admins."
      />

      <NewInventoryItemForm
        brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
        customFields={fields.map((field) => ({
          key: field.key,
          label: field.label,
          fieldType: field.fieldType,
          required: field.required,
          defaultValue: field.defaultValue,
          config: (field.config as Record<string, unknown> | null) ?? null,
        }))}
      />
    </div>
  );
}
