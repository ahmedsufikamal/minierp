export const maintenancePermissions = {
  scheduleRead: "maintenance.schedule.read",
  scheduleWrite: "maintenance.schedule.write",
  scheduleManage: "maintenance.schedule.manage",
  visitRead: "maintenance.visit.read",
  visitWrite: "maintenance.visit.write",
} as const;

export type MaintenancePermission = (typeof maintenancePermissions)[keyof typeof maintenancePermissions];
