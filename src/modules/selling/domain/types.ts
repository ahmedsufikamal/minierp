export const sellingPermissions = {
  salesOrderRead: "selling.sales-order.read",
  salesOrderWrite: "selling.sales-order.write",
  salesOrderApprove: "selling.sales-order.approve",
  deliveryNoteRead: "selling.delivery-note.read",
  deliveryNoteWrite: "selling.delivery-note.write",
  deliveryNotePost: "selling.delivery-note.post",
  dunningRead: "selling.dunning.read",
  dunningWrite: "selling.dunning.write",
  dunningManage: "selling.dunning.manage",
  receivableRead: "selling.receivable.read",
} as const;

export type SellingPermission = (typeof sellingPermissions)[keyof typeof sellingPermissions];
