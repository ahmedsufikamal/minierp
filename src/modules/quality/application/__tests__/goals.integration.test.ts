import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyQualityGoalAction,
  createQualityGoal,
  listQualityGoals,
} from "@/modules/quality/application/goals.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("quality goals integration", () => {
  const marker = `quality-goals-${Date.now()}`;
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
    await prisma.qualityFeedback.deleteMany({ where: { companyId } });
    await prisma.qualityGoal.deleteMany({ where: { companyId } });
  });

  it("creates, lists, and transitions quality goals with feedback", async () => {
    const goal = await createQualityGoal(ctx, {
      key: `${marker}-goal-1`,
      name: "Reduce defects",
      metric: "Defect rate",
      targetValue: 2.5,
      currentValue: 4.2,
    });

    expect(goal.status).toBe("DRAFT");

    const listed = await listQualityGoals(ctx, {
      page: 1,
      limit: 10,
      q: marker,
    });

    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.rows.some((row) => row.id === goal.id)).toBe(true);

    const active = await applyQualityGoalAction(ctx, goal.id, { action: "ACTIVATE" });
    expect(active.status).toBe("ACTIVE");

    const progressed = await applyQualityGoalAction(ctx, goal.id, {
      action: "UPDATE_PROGRESS",
      currentValue: 3.1,
    });
    expect(String(progressed.currentValue)).toBe("3.1");

    const feedback = await applyQualityGoalAction(ctx, goal.id, {
      action: "LOG_FEEDBACK",
      rating: 4,
      comments: "Trend is improving",
    });
    expect(feedback.feedbacks.length).toBeGreaterThan(0);

    const achieved = await applyQualityGoalAction(ctx, goal.id, { action: "ACHIEVE" });
    expect(achieved.status).toBe("ACHIEVED");

    const closed = await applyQualityGoalAction(ctx, goal.id, { action: "CLOSE" });
    expect(closed.status).toBe("CLOSED");
  });

  it("rejects invalid transition from draft to achieved", async () => {
    const goal = await createQualityGoal(ctx, {
      key: `${marker}-goal-2`,
      name: "First pass yield",
      metric: "FPY",
      targetValue: 98,
    });

    await expect(
      applyQualityGoalAction(ctx, goal.id, {
        action: "ACHIEVE",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires feedback comments or rating", async () => {
    const goal = await createQualityGoal(ctx, {
      key: `${marker}-goal-3`,
      name: "Inspection consistency",
      metric: "Variance",
      targetValue: 1,
    });

    await applyQualityGoalAction(ctx, goal.id, { action: "ACTIVATE" });

    await expect(
      applyQualityGoalAction(ctx, goal.id, {
        action: "LOG_FEEDBACK",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
