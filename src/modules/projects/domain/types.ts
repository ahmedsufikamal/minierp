export const projectsPermissions = {
  projectRead: "projects.project.read",
  projectWrite: "projects.project.write",
  projectApprove: "projects.project.approve",
  taskRead: "projects.task.read",
  taskWrite: "projects.task.write",
  taskApprove: "projects.task.approve",
  timesheetRead: "projects.timesheet.read",
  timesheetWrite: "projects.timesheet.write",
  timesheetApprove: "projects.timesheet.approve",
  billingRead: "projects.billing.read",
  billingWrite: "projects.billing.write",
  billingApprove: "projects.billing.approve",
} as const;

export type ProjectsPermission = (typeof projectsPermissions)[keyof typeof projectsPermissions];
