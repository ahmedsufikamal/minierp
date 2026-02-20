import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCommunicationLog } from "@/modules/communication/application/logs.service";
import { createCommunicationWindow } from "@/modules/communication/application/windows.service";
import { applyProjectAction, createProject } from "@/modules/projects/application/projects.service";
import { applyProjectTaskAction, createProjectTask } from "@/modules/projects/application/tasks.service";
import { applyTimesheetAction, createTimesheet } from "@/modules/projects/application/timesheets.service";
import { createSlaPolicy } from "@/modules/support/application/sla-policies.service";
import { createSupportQueue } from "@/modules/support/application/queues.service";
import { applyTicketAction, createTicket } from "@/modules/support/application/tickets.service";
import { applyCallLogAction, createCallLog } from "@/modules/telephony/application/call-logs.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("wave7 projects-support-communication-telephony integration", () => {
  const marker = `wave7-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let customerId = "";

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

    const customer = await prisma.customer.create({
      data: {
        companyId,
        name: `${marker}-customer`,
      },
      select: { id: true },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.callLog.deleteMany({ where: { companyId } });
    await prisma.communicationLog.deleteMany({ where: { companyId } });
    await prisma.communicationWindow.deleteMany({ where: { companyId } });

    await prisma.ticketEvent.deleteMany({ where: { ticket: { companyId } } });
    await prisma.ticket.deleteMany({ where: { companyId } });
    await prisma.slaPolicy.deleteMany({ where: { companyId } });
    await prisma.supportQueue.deleteMany({ where: { companyId } });

    await prisma.timesheet.deleteMany({ where: { companyId } });
    await prisma.projectTask.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });

    await prisma.customer.deleteMany({ where: { companyId } });
  });

  it("runs project lifecycle with support SLA pause/resume and communication-call linkage", async () => {
    const project = await createProject(ctx, {
      code: `${marker}-PRJ-001`,
      name: "Wave7 Implementation Project",
      customerId,
    });

    const activeProject = await applyProjectAction(ctx, project.id, { action: "START" });
    expect(activeProject.status).toBe("ACTIVE");

    const task = await createProjectTask(ctx, {
      projectId: project.id,
      title: "Implementation task",
      plannedMins: 240,
    });

    await applyProjectTaskAction(ctx, task.id, { action: "START" });
    const doneTask = await applyProjectTaskAction(ctx, task.id, { action: "DONE" });
    expect(doneTask.status).toBe("DONE");

    const timesheet = await createTimesheet(ctx, {
      projectId: project.id,
      taskId: task.id,
      workerRef: "employee-1",
      minutes: 180,
    });

    await applyTimesheetAction(ctx, timesheet.id, { action: "SUBMIT" });
    const approvedTimesheet = await applyTimesheetAction(ctx, timesheet.id, { action: "APPROVE" });
    expect(approvedTimesheet.status).toBe("APPROVED");

    const queue = await createSupportQueue(ctx, {
      name: `${marker}-queue`,
    });

    const sla = await createSlaPolicy(ctx, {
      name: `${marker}-sla`,
      queueId: queue.id,
      firstResponseMins: 30,
      resolutionMins: 240,
    });

    const ticket = await createTicket(ctx, {
      number: `${marker}-TKT-001`,
      subject: "Support request",
      customerId,
      projectId: project.id,
      queueId: queue.id,
      slaPolicyId: sla.id,
    });

    await applyTicketAction(ctx, ticket.id, { action: "ASSIGN", assignedTo: "agent-1" });
    await applyTicketAction(ctx, ticket.id, { action: "RESPOND" });
    await applyTicketAction(ctx, ticket.id, { action: "PAUSE" });
    const resumedTicket = await applyTicketAction(ctx, ticket.id, { action: "RESUME" });

    expect(resumedTicket.pauseStartedAt).toBeNull();
    expect(resumedTicket.pausedMinutes).toBeGreaterThanOrEqual(0);

    const resolvedTicket = await applyTicketAction(ctx, ticket.id, { action: "RESOLVE" });
    expect(resolvedTicket.status).toBe("RESOLVED");

    const window = await createCommunicationWindow(ctx, {
      queueId: queue.id,
      name: "Business Hours",
      channel: "EMAIL",
      startsAt: "09:00",
      endsAt: "18:00",
      timezone: "UTC",
    });

    expect(window.channel).toBe("EMAIL");

    const communication = await createCommunicationLog(ctx, {
      queueId: queue.id,
      ticketId: ticket.id,
      customerId,
      channel: "EMAIL",
      direction: "OUTBOUND",
      status: "SENT",
      subject: "Update",
      body: "Issue under review",
    });

    expect(communication.status).toBe("SENT");

    const call = await createCallLog(ctx, {
      queueId: queue.id,
      ticketId: ticket.id,
      customerId,
      direction: "OUTBOUND",
      status: "RINGING",
      phoneNumber: "+15550001111",
    });

    const answered = await applyCallLogAction(ctx, call.id, { action: "ANSWER" });
    expect(answered.status).toBe("ANSWERED");

    const ended = await applyCallLogAction(ctx, call.id, { action: "END", durationSecs: 95 });
    expect(ended.status).toBe("ENDED");
    expect(ended.durationSecs).toBe(95);
  });
});
