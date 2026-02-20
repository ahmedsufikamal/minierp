export const hrPermissions = {
  employeeRead: "hr.employee.read",
  employeeWrite: "hr.employee.write",
  leaveRead: "hr.leave.read",
  leaveWrite: "hr.leave.write",
  leaveApprove: "hr.leave.approve",
  attendanceRead: "hr.attendance.read",
  attendanceWrite: "hr.attendance.write",
  expenseRead: "hr.expense.read",
  expenseWrite: "hr.expense.write",
  expenseApprove: "hr.expense.approve",
} as const;

export type HrPermission = (typeof hrPermissions)[keyof typeof hrPermissions];
