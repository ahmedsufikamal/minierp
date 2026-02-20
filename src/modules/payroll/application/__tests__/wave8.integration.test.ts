import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createAttendance } from "@/modules/hr/application/attendance.service";
import { applyExpenseClaimAction, createExpenseClaim } from "@/modules/hr/application/expense-claims.service";
import {
  applyLeaveApplicationAction,
  createLeaveAllocation,
  createLeaveApplication,
} from "@/modules/hr/application/leaves.service";
import { createEmployee } from "@/modules/hr/application/employees.service";
import { applyPayrollEntryAction, createPayrollEntry } from "@/modules/payroll/application/payroll-entries.service";
import { applyPayslipAction, createPayslip } from "@/modules/payroll/application/payslips.service";
import { createSalaryStructure } from "@/modules/payroll/application/salary-structures.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("wave8 hr-payroll integration", () => {
  const marker = `wave8-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let departmentId = "";
  let designationId = "";
  let employeeId = "";
  let accountingPeriodId = "";

  const ctx: PlatformRequestContext = {
    requestId: `${marker}-request`,
    tenantId,
    companyId,
    userId: `${marker}-user`,
    role: "OWNER",
    platformRole: "SUPER_ADMIN",
    permissions: [],
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    const department = await prisma.setupDepartment.create({
      data: {
        tenantId,
        companyId,
        name: `${marker}-department`,
      },
      select: { id: true },
    });
    departmentId = department.id;

    const designation = await prisma.setupDesignation.create({
      data: {
        tenantId,
        companyId,
        name: `${marker}-designation`,
      },
      select: { id: true },
    });
    designationId = designation.id;

    const fiscalYear = await prisma.fiscalYear.create({
      data: {
        tenantId,
        companyId,
        name: `${marker}-FY`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      },
      select: { id: true },
    });

    const period = await prisma.accountingPeriod.create({
      data: {
        tenantId,
        companyId,
        fiscalYearId: fiscalYear.id,
        name: `${marker}-P01`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        status: "OPEN",
      },
      select: { id: true },
    });

    accountingPeriodId = period.id;
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { companyId } });

    await prisma.expenseClaim.deleteMany({ where: { companyId } });
    await prisma.payslip.deleteMany({ where: { companyId } });
    await prisma.payrollEntryEmployee.deleteMany({ where: { payrollEntry: { companyId } } });
    await prisma.payrollEntry.deleteMany({ where: { companyId } });
    await prisma.salaryStructure.deleteMany({ where: { companyId } });

    await prisma.attendance.deleteMany({ where: { companyId } });
    await prisma.leaveApplication.deleteMany({ where: { companyId } });
    await prisma.leaveAllocation.deleteMany({ where: { companyId } });
    await prisma.employee.deleteMany({ where: { companyId } });

    await prisma.accountingPeriod.deleteMany({ where: { companyId } });
    await prisma.fiscalYear.deleteMany({ where: { companyId } });
    await prisma.setupDesignation.deleteMany({ where: { companyId } });
    await prisma.setupDepartment.deleteMany({ where: { companyId } });
  });

  it("runs employee/leave/expense and payroll posting flow", async () => {
    const employee = await createEmployee(ctx, {
      employeeNo: `${marker}-EMP-001`,
      fullName: "Wave8 Employee",
      departmentId,
      designationId,
      dateOfJoining: new Date("2026-01-02"),
    });
    employeeId = employee.id;

    const allocation = await createLeaveAllocation(ctx, {
      employeeId,
      leaveType: "Annual",
      totalDays: 12,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
    });
    expect(allocation.usedDays).toBe(0);

    const leaveApplication = await createLeaveApplication(ctx, {
      employeeId,
      leaveType: "Annual",
      fromDate: new Date("2026-02-10"),
      toDate: new Date("2026-02-11"),
      totalDays: 2,
    });

    await applyLeaveApplicationAction(ctx, leaveApplication.id, { action: "SUBMIT" });
    const approvedLeave = await applyLeaveApplicationAction(ctx, leaveApplication.id, { action: "APPROVE" });
    expect(approvedLeave.status).toBe("APPROVED");

    const refreshedAllocation = await prisma.leaveAllocation.findUnique({
      where: { id: allocation.id },
      select: { usedDays: true },
    });
    expect(refreshedAllocation?.usedDays).toBe(2);

    const attendance = await createAttendance(ctx, {
      employeeId,
      attendanceDate: new Date("2026-01-03"),
      status: "PRESENT",
    });
    expect(attendance.status).toBe("PRESENT");

    const claim = await createExpenseClaim(ctx, {
      number: `${marker}-EX-001`,
      employeeId,
      claimDate: new Date("2026-01-05"),
      amountMinor: 15000,
      currency: "BDT",
      description: "Client travel",
    });

    await applyExpenseClaimAction(ctx, claim.id, { action: "SUBMIT" });
    await applyExpenseClaimAction(ctx, claim.id, { action: "APPROVE" });
    const paidClaim = await applyExpenseClaimAction(ctx, claim.id, { action: "PAY" });
    expect(paidClaim.status).toBe("PAID");

    const salaryStructure = await createSalaryStructure(ctx, {
      name: `${marker}-SS-001`,
      currency: "BDT",
      baseAmountMinor: 100000,
      allowancesMinor: 10000,
      deductionsMinor: 5000,
      effectiveFrom: new Date("2026-01-01"),
    });

    const payrollEntry = await createPayrollEntry(ctx, {
      number: `${marker}-PE-001`,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      payDate: new Date("2026-01-31"),
      salaryStructureId: salaryStructure.id,
      accountingPeriodId,
      employees: [
        {
          employeeId,
          grossPayMinor: 110000,
          deductionsMinor: 5000,
          netPayMinor: 105000,
        },
      ],
    });

    await applyPayrollEntryAction(ctx, payrollEntry.id, { action: "SUBMIT" });
    const postedEntry = await applyPayrollEntryAction(ctx, payrollEntry.id, { action: "POST" });
    expect(postedEntry.status).toBe("POSTED");

    const payslip = await createPayslip(ctx, {
      number: `${marker}-PS-001`,
      payrollEntryId: payrollEntry.id,
      employeeId,
      salaryStructureId: salaryStructure.id,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-01-31"),
      payDate: new Date("2026-01-31"),
      grossPayMinor: 110000,
      deductionsMinor: 5000,
      netPayMinor: 105000,
    });

    await applyPayslipAction(ctx, payslip.id, { action: "GENERATE" });
    const postedPayslip = await applyPayslipAction(ctx, payslip.id, { action: "POST" });
    expect(postedPayslip.status).toBe("POSTED");
  });
});
