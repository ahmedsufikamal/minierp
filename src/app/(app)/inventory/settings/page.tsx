import PageHeader from "@/components/page-header";
import { hasInventoryPermission } from "@/modules/inventory/application/policy";
import { inventoryPermissions } from "@/modules/inventory/domain/types";
import { getInventoryPageContextAuthenticated } from "@/modules/inventory/interface/page-context";
import {
  hasIamInventoryPermission,
  isIamInventoryPermissionSyncEnabled,
} from "@/modules/inventory/interface/permissions";
import { InventorySettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function InventorySettingsPage() {
  const ctx = await getInventoryPageContextAuthenticated();
  const canEdit = isIamInventoryPermissionSyncEnabled() && Array.isArray(ctx.iamPermissions) && ctx.iamPermissions.length > 0
    ? hasIamInventoryPermission(ctx.iamPermissions, inventoryPermissions.settingsWrite)
    : hasInventoryPermission(ctx.role, inventoryPermissions.settingsWrite);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Settings"
        subtitle="Configure stock defaults, validations, reservations, serial/batch behavior, planning, and stock closing rules."
      />
      <InventorySettingsClient canEdit={canEdit} />
    </div>
  );
}
