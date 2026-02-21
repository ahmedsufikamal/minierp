import { assertInventoryPermission } from "@/modules/inventory/application/policy";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryPermission, InventoryRequestContext } from "@/modules/inventory/domain/types";

const inventoryPermissionCompatibility: Record<InventoryPermission, string[]> = {
  "inventory.item.read": ["inventory.read"],
  "inventory.item.write": ["inventory.write"],
  "inventory.item.delete": ["inventory.write"],
  "inventory.document.read": ["inventory.read"],
  "inventory.document.write": ["inventory.write"],
  "inventory.document.approve": ["inventory.approve", "inventory.write"],
  "inventory.document.post": ["inventory.approve", "inventory.write"],
  "inventory.ledger.read": ["inventory.read"],
  "inventory.settings.read": ["inventory.read"],
  "inventory.settings.write": ["inventory.write"],
  "inventory.import.read": ["inventory.read"],
  "inventory.import.write": ["inventory.write"],
  "inventory.export.read": ["inventory.read"],
  "inventory.export.write": ["inventory.write"],
  "inventory.attachment.write": ["inventory.write"],
  "inventory.attachment.read": ["inventory.read"],
  "inventory.overrideNegativeStock": ["inventory.approve", "inventory.write"],
};

export function isIamInventoryPermissionSyncEnabled(): boolean {
  const explicit = process.env.IAM_INVENTORY_PERMISSION_SYNC_ENABLED;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return true;
}

export function hasIamInventoryPermission(granted: string[] | undefined, required: InventoryPermission): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes(required)) return true;
  const aliases = inventoryPermissionCompatibility[required] ?? [];
  return aliases.some((alias) => granted.includes(alias));
}

export function assertInventoryPermissionForContext(
  ctx: InventoryRequestContext,
  permission: InventoryPermission,
): void {
  if (isIamInventoryPermissionSyncEnabled() && Array.isArray(ctx.iamPermissions) && ctx.iamPermissions.length > 0) {
    if (!hasIamInventoryPermission(ctx.iamPermissions, permission)) {
      throw new InventoryError("FORBIDDEN", `Missing permission: ${permission}`);
    }
    return;
  }

  assertInventoryPermission(ctx.role, permission);
}
