export const utilitiesPermissions = {
  taskRead: "utilities.task.read",
  taskWrite: "utilities.task.write",
  taskManage: "utilities.task.manage",
} as const;

export type UtilitiesPermission = (typeof utilitiesPermissions)[keyof typeof utilitiesPermissions];
