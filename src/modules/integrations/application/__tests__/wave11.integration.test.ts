import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyBulkJobAction, createBulkJob } from "@/modules/bulk/application/jobs.service";
import { createEdiCodeList } from "@/modules/edi/application/code-lists.service";
import {
  applyEdiTransportAction,
  createEdiTransport,
} from "@/modules/edi/application/transports.service";
import { enqueueEmail } from "@/modules/integrations/application/email-queue.service";
import {
  applyApiTokenAction,
  createApiToken,
} from "@/modules/integrations/application/tokens.service";
import { createEmailTemplate } from "@/modules/integrations/application/templates.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  applyUtilityTaskAction,
  createUtilityTask,
} from "@/modules/utilities/application/tasks.service";

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("wave11 integrations-edi-bulk-utilities integration", () => {
  const marker = `wave11-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

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
  });

  afterAll(async () => {
    await prisma.utilityTask.deleteMany({ where: { companyId } });
    await prisma.bulkJobItem.deleteMany({ where: { job: { companyId } } });
    await prisma.bulkJob.deleteMany({ where: { companyId } });
    await prisma.ediTransport.deleteMany({ where: { companyId } });
    await prisma.ediCodeList.deleteMany({ where: { companyId } });
    await prisma.integrationApiToken.deleteMany({ where: { companyId } });
    await prisma.integrationEmailQueue.deleteMany({ where: { companyId } });
    await prisma.integrationEmailTemplate.deleteMany({ where: { companyId } });
  });

  it("runs integration, EDI, bulk job, and utility task lifecycles", async () => {
    const template = await createEmailTemplate(ctx, {
      key: `${marker}-template`,
      name: "Wave11 Template",
      subject: "Hello",
      body: "Body",
    });

    const queuedEmail = await enqueueEmail(ctx, {
      templateId: template.id,
      toEmail: "ops@example.com",
      subject: "Queued",
      body: "Queued body",
    });
    expect(queuedEmail.status).toBe("QUEUED");

    const apiToken = await createApiToken(ctx, {
      name: `${marker}-token`,
      tokenHash: `${marker}-hash`,
      scopes: ["inventory.read", "sales.write"],
    });

    const revokedToken = await applyApiTokenAction(ctx, apiToken.id, { action: "REVOKE" });
    expect(revokedToken.status).toBe("REVOKED");

    const code = await createEdiCodeList(ctx, {
      listType: "INCOTERM",
      code: "EXW",
      value: "Ex Works",
    });
    expect(code.code).toBe("EXW");

    const transport = await createEdiTransport(ctx, {
      name: `${marker}-sftp`,
      type: "SFTP",
      config: { host: "sftp.example.com", path: "/inbound" },
    });

    const inactiveTransport = await applyEdiTransportAction(ctx, transport.id, {
      action: "DEACTIVATE",
    });
    expect(inactiveTransport.status).toBe("INACTIVE");

    const job = await createBulkJob(ctx, {
      name: `${marker}-bulk-job`,
      items: [
        {
          itemKey: "row-1",
        },
        {
          itemKey: "row-2",
        },
      ],
      payload: { file: "customers.csv" },
    });

    const completedJob = await applyBulkJobAction(ctx, job.id, {
      action: "RUN",
      result: { processed: 2 },
    });
    expect(completedJob.status).toBe("COMPLETED");

    const task = await createUtilityTask(ctx, {
      name: `${marker}-cleanup`,
      input: { dryRun: false },
    });

    const runningTask = await applyUtilityTaskAction(ctx, task.id, {
      action: "START",
    });
    expect(runningTask.status).toBe("RUNNING");

    const completedTask = await applyUtilityTaskAction(ctx, task.id, {
      action: "COMPLETE",
      output: { cleaned: 42 },
    });
    expect(completedTask.status).toBe("COMPLETED");
  });
});
