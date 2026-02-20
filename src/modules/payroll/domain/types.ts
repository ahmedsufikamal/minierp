export const payrollPermissions = {
  salaryStructureRead: "payroll.salary-structure.read",
  salaryStructureWrite: "payroll.salary-structure.write",
  payrollEntryRead: "payroll.entry.read",
  payrollEntryWrite: "payroll.entry.write",
  payrollEntryPost: "payroll.entry.post",
  payslipRead: "payroll.payslip.read",
  payslipWrite: "payroll.payslip.write",
  payslipPost: "payroll.payslip.post",
} as const;

export type PayrollPermission = (typeof payrollPermissions)[keyof typeof payrollPermissions];
