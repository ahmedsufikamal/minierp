export const posPermissions = {
  profileRead: "pos.profile.read",
  profileWrite: "pos.profile.write",
  shiftRead: "pos.shift.read",
  shiftWrite: "pos.shift.write",
  shiftManage: "pos.shift.manage",
  saleRead: "pos.sale.read",
  saleWrite: "pos.sale.write",
  salePay: "pos.sale.pay",
} as const;

export type PosPermission = (typeof posPermissions)[keyof typeof posPermissions];
