export const inventoryPermissions = {
  itemRead: "inventory.item.read",
  itemWrite: "inventory.item.write",
  itemDelete: "inventory.item.delete",
  documentRead: "inventory.document.read",
  documentWrite: "inventory.document.write",
  documentApprove: "inventory.document.approve",
  documentPost: "inventory.document.post",
  ledgerRead: "inventory.ledger.read",
  settingsRead: "inventory.settings.read",
  settingsWrite: "inventory.settings.write",
  importRead: "inventory.import.read",
  importWrite: "inventory.import.write",
  exportRead: "inventory.export.read",
  exportWrite: "inventory.export.write",
  attachmentWrite: "inventory.attachment.write",
  attachmentRead: "inventory.attachment.read",
  overrideNegativeStock: "inventory.overrideNegativeStock",
} as const;

export type InventoryPermission = (typeof inventoryPermissions)[keyof typeof inventoryPermissions];

export type InventoryRole =
  | "SUPER_ADMIN"
  | "COMPANY_OWNER"
  | "COMPANY_ADMIN"
  | "INVENTORY_MANAGER"
  | "WAREHOUSE_OPERATOR"
  | "VIEWER"
  | "AUDITOR";

export type InventoryRequestContext = {
  requestId: string;
  companyId: string;
  userId: string;
  role: InventoryRole;
  ipAddress?: string;
  userAgent?: string;
};
