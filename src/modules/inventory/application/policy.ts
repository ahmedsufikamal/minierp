import { InventoryError } from "@/modules/inventory/domain/errors";
import { type InventoryPermission, type InventoryRole, inventoryPermissions } from "@/modules/inventory/domain/types";

const allPermissions = new Set<InventoryPermission>(Object.values(inventoryPermissions));

const rolePermissionMap: Record<InventoryRole, Set<InventoryPermission>> = {
  SUPER_ADMIN: new Set(allPermissions),
  COMPANY_OWNER: new Set(allPermissions),
  COMPANY_ADMIN: new Set(allPermissions),
  INVENTORY_MANAGER: new Set([
    inventoryPermissions.itemRead,
    inventoryPermissions.itemWrite,
    inventoryPermissions.documentRead,
    inventoryPermissions.documentWrite,
    inventoryPermissions.documentApprove,
    inventoryPermissions.documentPost,
    inventoryPermissions.ledgerRead,
    inventoryPermissions.settingsRead,
    inventoryPermissions.settingsWrite,
    inventoryPermissions.importRead,
    inventoryPermissions.importWrite,
    inventoryPermissions.exportRead,
    inventoryPermissions.exportWrite,
    inventoryPermissions.attachmentRead,
    inventoryPermissions.attachmentWrite,
  ]),
  WAREHOUSE_OPERATOR: new Set([
    inventoryPermissions.itemRead,
    inventoryPermissions.documentRead,
    inventoryPermissions.documentWrite,
    inventoryPermissions.ledgerRead,
    inventoryPermissions.importRead,
    inventoryPermissions.attachmentRead,
    inventoryPermissions.attachmentWrite,
  ]),
  VIEWER: new Set([
    inventoryPermissions.itemRead,
    inventoryPermissions.documentRead,
    inventoryPermissions.ledgerRead,
    inventoryPermissions.settingsRead,
    inventoryPermissions.attachmentRead,
  ]),
  AUDITOR: new Set([
    inventoryPermissions.itemRead,
    inventoryPermissions.documentRead,
    inventoryPermissions.ledgerRead,
    inventoryPermissions.exportRead,
    inventoryPermissions.exportWrite,
    inventoryPermissions.settingsRead,
  ]),
};

export function mapUserRoleToInventoryRole(role: string | null | undefined): InventoryRole {
  switch ((role ?? "").toUpperCase()) {
    case "SUPER_ADMIN":
      return "SUPER_ADMIN";
    case "OWNER":
    case "COMPANY_OWNER":
      return "COMPANY_OWNER";
    case "COMPANY_SUPER_ADMIN":
    case "COMPANY_OWNER_ADMIN":
    case "TENANT_ADMIN":
    case "COMPANY_ADMIN":
    case "ADMIN":
      return "COMPANY_ADMIN";
    case "MANAGER":
    case "INVENTORY_MANAGER":
      return "INVENTORY_MANAGER";
    case "MEMBER":
    case "WAREHOUSE_OPERATOR":
      return "WAREHOUSE_OPERATOR";
    case "AUDITOR":
      return "AUDITOR";
    case "VIEWER":
      return "VIEWER";
    default:
      return "WAREHOUSE_OPERATOR";
  }
}

export function hasInventoryPermission(role: InventoryRole, permission: InventoryPermission): boolean {
  const set = rolePermissionMap[role] ?? new Set<InventoryPermission>();
  return set.has(permission);
}

export function assertInventoryPermission(role: InventoryRole, permission: InventoryPermission): void {
  if (!hasInventoryPermission(role, permission)) {
    throw new InventoryError("FORBIDDEN", `Missing permission: ${permission}`);
  }
}
