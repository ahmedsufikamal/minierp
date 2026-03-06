import {
  OpsActionExecutionStatus,
  OpsExceptionSeverity,
  OpsExceptionStatus,
  OpsTaskPriority,
  OpsTaskStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  taskFindMany: vi.fn(),
  exceptionFindMany: vi.fn(),
  taskCount: vi.fn(),
  exceptionCount: vi.fn(),
  appendAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    opsActionExecution: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
    },
    opsTask: {
      findMany: mocks.taskFindMany,
      count: mocks.taskCount,
    },
    opsException: {
      findMany: mocks.exceptionFindMany,
      count: mocks.exceptionCount,
    },
    aiRecommendation: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    aiResolutionDraft: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    aiFeedbackEvent: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/modules/platform/application/audit-ledger.service", () => ({
  appendAuditEvent: mocks.appendAuditEvent,
  stableStringify: (value: unknown) => JSON.stringify(value),
}));

import { executeWorkflowActionCommand, listOpsInbox } from "@/modules/platform/application/ops-ai.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const ctx: PlatformRequestContext = {
  requestId: "req-1",
  tenantId: "tenant-1",
  companyId: "company-1",
  userId: "user-1",
  role: "INVENTORY_MANAGER",
  platformRole: "NONE",
  permissions: ["platform.reporting.read", "platform.reporting.write"],
};

beforeEach(() => {
  Object.values(mocks).forEach((mockFn) => {
    mockFn.mockReset();
  });
});

describe("ops ai service", () => {
  it("executes workflow action commands and replays idempotent requests", async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "exec-1",
      actionId: "delivery-note.submit",
      commandKey: "ops.delivery-note.submit",
      idempotencyKey: "idem-1",
      status: OpsActionExecutionStatus.SUCCEEDED,
      input: {
        requestFingerprint: JSON.stringify({
          actionId: "delivery-note.submit",
          commandKey: "ops.delivery-note.submit",
          payload: {
            contextType: "sales-order",
            contextRef: "SO-001",
            notes: "ship now",
            expectedState: "SUBMITTED",
          },
        }),
      },
      output: {
        actionId: "delivery-note.submit",
        commandKey: "ops.delivery-note.submit",
        idempotencyKey: "idem-1",
        executedAt: "2026-03-06T00:00:00.000Z",
        result: { accepted: true, executionId: "exec-1" },
      },
      reversibleState: {
        revertActionId: "delivery-note.submit:rollback",
        beforeState: "SO-001",
        afterState: "SUBMITTED",
        rollbackReady: true,
      },
    });

    mocks.create.mockResolvedValue({
      id: "exec-1",
      actionId: "delivery-note.submit",
      commandKey: "ops.delivery-note.submit",
      idempotencyKey: "idem-1",
      status: OpsActionExecutionStatus.PENDING,
    });

    mocks.update.mockResolvedValue({
      id: "exec-1",
      actionId: "delivery-note.submit",
      commandKey: "ops.delivery-note.submit",
      idempotencyKey: "idem-1",
      status: OpsActionExecutionStatus.SUCCEEDED,
      output: {
        actionId: "delivery-note.submit",
        commandKey: "ops.delivery-note.submit",
        idempotencyKey: "idem-1",
        executedAt: "2026-03-06T00:00:00.000Z",
        result: { accepted: true, executionId: "exec-1" },
      },
      reversibleState: {
        revertActionId: "delivery-note.submit:rollback",
        beforeState: "SO-001",
        afterState: "SUBMITTED",
        rollbackReady: true,
      },
    });

    const first = await executeWorkflowActionCommand(
      ctx,
      "delivery-note.submit",
      {
        contextType: "sales-order",
        contextRef: "SO-001",
        notes: "ship now",
        expectedState: "SUBMITTED",
      },
      "idem-1",
    );

    expect(first.status).toBe("SUCCEEDED");
    expect(first.reversibleState.rollbackReady).toBe(true);

    const second = await executeWorkflowActionCommand(
      ctx,
      "delivery-note.submit",
      {
        contextType: "sales-order",
        contextRef: "SO-001",
        notes: "ship now",
        expectedState: "SUBMITTED",
      },
      "idem-1",
    );

    expect(second.status).toBe("REPLAYED");
    expect(second.idempotencyKey).toBe("idem-1");
  });

  it("merges ops tasks and exceptions into inbox rows", async () => {
    mocks.taskFindMany.mockResolvedValue([
      {
        id: "task-1",
        title: "Approve delivery note",
        summary: "DN-001 waiting for approval",
        priority: OpsTaskPriority.HIGH,
        status: OpsTaskStatus.OPEN,
        dueAt: new Date("2026-03-07T00:00:00.000Z"),
        sourceType: "DeliveryNote",
        sourceId: "DN-001",
        assigneeUserId: "user-1",
        metadata: { lane: "shipping" },
        createdAt: new Date("2026-03-06T00:00:00.000Z"),
      },
    ]);
    mocks.exceptionFindMany.mockResolvedValue([
      {
        id: "exc-1",
        kind: "SHORTAGE",
        severity: OpsExceptionSeverity.CRITICAL,
        status: OpsExceptionStatus.OPEN,
        summary: "Critical stock shortage",
        details: { itemCode: "ITEM-001" },
        sourceType: "Inventory",
        sourceId: "ITEM-001",
        detectedAt: new Date("2026-03-06T01:00:00.000Z"),
        createdAt: new Date("2026-03-06T01:00:00.000Z"),
      },
    ]);
    mocks.taskCount.mockResolvedValue(1);
    mocks.exceptionCount.mockResolvedValue(1);

    const inbox = await listOpsInbox(ctx, {
      page: 1,
      limit: 10,
    });

    expect(inbox.total).toBe(2);
    expect(inbox.summary.openTasks).toBe(1);
    expect(inbox.summary.openExceptions).toBe(1);
    expect(inbox.rows[0]?.id).toBe("exc-1");
    expect(inbox.rows[1]?.id).toBe("task-1");
  });
});
