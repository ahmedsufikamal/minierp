import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyProjectBillingAction, createProjectBillingEntry, listProjectBillingEntries } from "@/modules/projects/application/billing.service";
import { createProject } from "@/modules/projects/application/projects.service";
import { applyTimesheetAction, createTimesheet } from "@/modules/projects/application/timesheets.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("projects billing integration", () => {
  const marker = `projects-billing-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let projectId = "";
  let approvedTimesheetId = "";
  let draftTimesheetId = "";

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

    const project = await createProject(ctx, {
      code: `${marker}-PRJ-001`,
      name: "Project Billing Integration",
    });
    projectId = project.id;

    const approved = await createTimesheet(ctx, {
      projectId,
      workerRef: "user-1",
      minutes: 120,
    });
    await applyTimesheetAction(ctx, approved.id, { action: "SUBMIT" });
    await applyTimesheetAction(ctx, approved.id, { action: "APPROVE" });
    approvedTimesheetId = approved.id;

    const draft = await createTimesheet(ctx, {
      projectId,
      workerRef: "user-2",
      minutes: 90,
    });
    draftTimesheetId = draft.id;
  });

  afterAll(async () => {
    await prisma.projectBillingEntry.deleteMany({ where: { companyId } });
    await prisma.timesheet.deleteMany({ where: { companyId } });
    await prisma.projectTask.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
  });

  it("creates, lists, and advances billing entries for approved timesheets", async () => {
    const created = await createProjectBillingEntry(ctx, {
      projectId,
      timesheetId: approvedTimesheetId,
      billAmountCents: 15000,
      currency: "USD",
      notes: "Initial billing entry",
    });

    expect(created.status).toBe("DRAFT");
    expect(created.billableMinutes).toBe(120);

    const list = await listProjectBillingEntries(ctx, {
      page: 1,
      limit: 10,
      projectId,
    });

    expect(list.total).toBeGreaterThanOrEqual(1);
    expect(list.rows.some((row) => row.id === created.id)).toBe(true);

    const ready = await applyProjectBillingAction(ctx, created.id, { action: "MARK_READY" });
    expect(ready.status).toBe("READY");

    const invoiced = await applyProjectBillingAction(ctx, created.id, { action: "MARK_INVOICED" });
    expect(invoiced.status).toBe("INVOICED");

    const reset = await applyProjectBillingAction(ctx, created.id, { action: "RESET" });
    expect(reset.status).toBe("DRAFT");
  });

  it("rejects billing entries for non-approved timesheets", async () => {
    await expect(
      createProjectBillingEntry(ctx, {
        projectId,
        timesheetId: draftTimesheetId,
        billAmountCents: 5000,
        currency: "USD",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects invalid action transitions", async () => {
    const created = await createProjectBillingEntry(ctx, {
      projectId,
      timesheetId: approvedTimesheetId,
      billAmountCents: 9000,
      currency: "USD",
    });

    await expect(
      applyProjectBillingAction(ctx, created.id, {
        action: "MARK_INVOICED",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
