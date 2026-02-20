export const subcontractingPermissions = {
  orderRead: "subcontracting.order.read",
  orderWrite: "subcontracting.order.write",
  orderApprove: "subcontracting.order.approve",
  receiptRead: "subcontracting.receipt.read",
  receiptWrite: "subcontracting.receipt.write",
  receiptAccept: "subcontracting.receipt.accept",
} as const;

export type SubcontractingPermission =
  (typeof subcontractingPermissions)[keyof typeof subcontractingPermissions];
