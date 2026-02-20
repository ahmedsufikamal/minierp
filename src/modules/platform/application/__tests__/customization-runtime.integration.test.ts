import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AutomationTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyAutomationRuleAction,
  applyFormLayoutAction,
  createAutomationRule,
  createFormLayout,
  createPropertyOverrideRule,
  resolveCustomizationRuntime,
} from "@/modules/platform/application/customization.service";
import { createAndExecuteAutomationRun } from "@/modules/platform/application/automation-runtime.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("platform customization runtime integration", () => {
  const marker = `customization-runtime-${Date.now()}`;
  const companyId = marker;
  const tenantId = marker;

  let projectId = "";

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

    const project = await prisma.project.create({
      data: {
        tenantId,
        companyId,
        code: `${marker}-PRJ-001`,
        name: "Automation Target Project",
      },
      select: { id: true },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.automationRuleRun.deleteMany({ where: { companyId } });
    await prisma.automationRule.deleteMany({ where: { companyId } });
    await prisma.propertyOverrideRule.deleteMany({ where: { companyId } });
    await prisma.formLayoutVersion.deleteMany({ where: { formLayout: { companyId } } });
    await prisma.formLayout.deleteMany({ where: { companyId } });
    await prisma.customField.deleteMany({ where: { companyId } });
    await prisma.validationRule.deleteMany({ where: { companyId } });
    await prisma.printTemplate.deleteMany({ where: { companyId } });
    await prisma.projectTask.deleteMany({ where: { companyId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.outboxEvent.deleteMany({ where: { companyId } });
    await prisma.auditEvent.deleteMany({ where: { companyId } });
  });

  it("publishes form layout, applies property overrides, and resolves runtime metadata", async () => {
    await prisma.customField.create({
      data: {
        tenantId,
        companyId,
        entityType: "Project",
        fieldKey: "riskLevel",
        label: "Risk Level",
        dataType: "TEXT",
        required: false,
        showInList: true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    const formLayout = await createFormLayout(ctx, {
      entityType: "Project",
      name: "Project Layout",
      isDefault: true,
      layout: {
        sections: [
          {
            key: "main",
            title: "Main",
            fields: ["name", "riskLevel"],
          },
        ],
      },
    });

    const published = await applyFormLayoutAction(ctx, formLayout.id, { action: "PUBLISH" });
    expect(published.versions.some((row) => row.status === "PUBLISHED")).toBe(true);

    const rule = await createPropertyOverrideRule(ctx, {
      entityType: "Project",
      target: "FIELD",
      key: "riskLevel",
      label: "Risk Level",
      config: {
        readOnly: false,
      },
      priority: 10,
    });
    expect(rule.isActive).toBe(true);

    const runtime = await resolveCustomizationRuntime(ctx, { entityType: "Project" });
    expect(runtime.customFields.length).toBeGreaterThan(0);
    expect(runtime.propertyOverrideRules.length).toBeGreaterThan(0);
    expect(runtime.activeFormLayout?.entityType).toBe("Project");
  });

  it("executes SET_FIELD, CREATE_TASK, and SEND_NOTIFICATION automation actions", async () => {
    const setFieldRule = await createAutomationRule(ctx, {
      entityType: "Project",
      name: "Set project notes",
      trigger: AutomationTrigger.ON_STATUS_CHANGE,
      actionType: "SET_FIELD",
      actionConfig: {
        entityType: "Project",
        field: "notes",
        value: "Updated by automation",
      },
    });

    const setFieldRun = await createAndExecuteAutomationRun(ctx, {
      automationRuleId: setFieldRule.id,
      entityType: "Project",
      entityId: projectId,
      trigger: AutomationTrigger.ON_STATUS_CHANGE,
      input: { status: "ACTIVE" },
    });

    expect(setFieldRun.status).toBe("SUCCEEDED");

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { notes: true },
    });
    expect(project.notes).toBe("Updated by automation");

    const createTaskRule = await createAutomationRule(ctx, {
      entityType: "Project",
      name: "Create follow-up task",
      trigger: AutomationTrigger.ON_SUBMIT,
      actionType: "CREATE_TASK",
      actionConfig: {
        projectId,
        title: "Follow-up task",
        description: "Generated by automation",
      },
    });

    const createTaskRun = await createAndExecuteAutomationRun(ctx, {
      automationRuleId: createTaskRule.id,
      entityType: "Project",
      entityId: projectId,
      trigger: AutomationTrigger.ON_SUBMIT,
      input: { submitted: true },
    });

    expect(createTaskRun.status).toBe("SUCCEEDED");

    const task = await prisma.projectTask.findFirst({
      where: { companyId, projectId, title: "Follow-up task" },
      select: { id: true },
    });
    expect(task?.id).toBeTruthy();

    const notifyRule = await createAutomationRule(ctx, {
      entityType: "Project",
      name: "Notify team",
      trigger: AutomationTrigger.ON_CREATE,
      actionType: "SEND_NOTIFICATION",
      actionConfig: {
        channel: "IN_APP",
        recipients: ["ops@example.com"],
        subject: "Project created",
        body: "Automation notification",
      },
    });

    const notifyRun = await applyAutomationRuleAction(ctx, notifyRule.id, {
      action: "RUN",
      trigger: AutomationTrigger.ON_CREATE,
      entityId: projectId,
      input: { created: true },
    });

    if (!("status" in notifyRun)) {
      throw new Error("Expected RUN action to return automation run details");
    }
    expect(notifyRun.status).toBe("SUCCEEDED");

    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        companyId,
        topic: "platform.automation.notification",
      },
      select: { id: true },
    });
    expect(outbox?.id).toBeTruthy();
  });

  it("rejects non-allowlisted webhook destinations with FORBIDDEN", async () => {
    const webhookRule = await createAutomationRule(ctx, {
      entityType: "Project",
      name: "Webhook callback",
      trigger: AutomationTrigger.ON_STATUS_CHANGE,
      actionType: "CALL_WEBHOOK",
      actionConfig: {
        url: "https://example.com/automation-hook",
        method: "POST",
      },
    });

    await expect(
      applyAutomationRuleAction(ctx, webhookRule.id, {
        action: "RUN",
        trigger: AutomationTrigger.ON_STATUS_CHANGE,
        entityId: projectId,
        input: { status: "ACTIVE" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
