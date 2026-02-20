import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyAssetAction, createAsset } from "@/modules/assets/application/assets.service";
import { createAssetCategory } from "@/modules/assets/application/categories.service";
import {
  applyMaintenanceScheduleAction,
  createMaintenanceSchedule,
} from "@/modules/maintenance/application/schedules.service";
import { createMaintenanceVisit } from "@/modules/maintenance/application/visits.service";
import { applyRegionalProfileAction, createRegionalProfile } from "@/modules/regional/application/profiles.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("wave9 assets-maintenance-regional integration", () => {
  const marker = `wave9-${Date.now()}`;
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
    await prisma.maintenanceVisit.deleteMany({ where: { companyId } });
    await prisma.maintenanceSchedule.deleteMany({ where: { companyId } });
    await prisma.assetDepreciationEntry.deleteMany({ where: { companyId } });
    await prisma.asset.deleteMany({ where: { companyId } });
    await prisma.assetCategory.deleteMany({ where: { companyId } });
    await prisma.regionalProfile.deleteMany({ where: { companyId } });
  });

  it("runs asset lifecycle with depreciation, maintenance completion, disposal lock and regional profile toggle", async () => {
    const category = await createAssetCategory(ctx, {
      name: `${marker}-category`,
      usefulLifeMonths: 60,
      depreciationMethod: "STRAIGHT_LINE",
    });

    const asset = await createAsset(ctx, {
      assetNo: `${marker}-AST-001`,
      name: "Wave9 Asset",
      categoryId: category.id,
      acquiredOn: new Date("2026-01-05"),
      costMinor: 120000,
      salvageMinor: 20000,
      usefulLifeMonths: 60,
      depreciationMethod: "STRAIGHT_LINE",
    });

    const activeAsset = await applyAssetAction(ctx, asset.id, { action: "ACTIVATE" });
    expect(activeAsset.status).toBe("ACTIVE");

    const depreciated = await applyAssetAction(ctx, asset.id, {
      action: "POST_DEPRECIATION",
      amountMinor: 10000,
      postingDate: new Date("2026-01-31"),
    });
    expect(depreciated.currentBookValueMinor).toBe(110000);

    const schedule = await createMaintenanceSchedule(ctx, {
      assetId: asset.id,
      subject: "Quarterly service",
      scheduledOn: new Date("2026-02-10"),
      assignedTo: "tech-1",
    });

    const inProgressSchedule = await applyMaintenanceScheduleAction(ctx, schedule.id, { action: "START" });
    expect(inProgressSchedule.status).toBe("IN_PROGRESS");

    const visit = await createMaintenanceVisit(ctx, {
      scheduleId: schedule.id,
      assetId: asset.id,
      visitDate: new Date("2026-02-10"),
      technician: "tech-1",
    });
    expect(visit.scheduleId).toBe(schedule.id);

    const completedSchedule = await applyMaintenanceScheduleAction(ctx, schedule.id, { action: "COMPLETE" });
    expect(completedSchedule.status).toBe("COMPLETED");

    const disposed = await applyAssetAction(ctx, asset.id, {
      action: "DISPOSE",
      postingDate: new Date("2026-03-01"),
    });
    expect(disposed.status).toBe("DISPOSED");

    await expect(
      applyAssetAction(ctx, asset.id, {
        action: "POST_DEPRECIATION",
        amountMinor: 1000,
      }),
    ).rejects.toThrow(/cannot/i);

    const regionalProfile = await createRegionalProfile(ctx, {
      countryCode: "BD",
      profileKey: "VAT_DEFAULT",
      config: { vatRate: 15, tdsEnabled: true },
    });

    const inactiveRegionalProfile = await applyRegionalProfileAction(ctx, regionalProfile.id, {
      action: "DEACTIVATE",
    });
    expect(inactiveRegionalProfile.status).toBe("INACTIVE");
  });
});
