import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NumberSeriesResetPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateMasterSeriesNumber } from "@/modules/platform/application/master-number-series.service";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const maybeDescribe = runIntegration ? describe : describe.skip;

maybeDescribe("master number-series integration", () => {
  const marker = `mdm-series-${Date.now()}`;
  const tenantId = marker;
  const companyId = marker;

  const ctx: PlatformRequestContext = {
    requestId: `${marker}-request`,
    tenantId,
    companyId,
    userId: `${marker}-user`,
    role: "ADMIN",
    platformRole: "SUPER_ADMIN",
    permissions: ["master.write"],
  };

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;

    await prisma.numberSeries.create({
      data: {
        tenantId,
        companyId,
        key: "MDM_TEST_DOC",
        name: "MDM Test Doc",
        pattern: "MDM-{YYYY}-{####}",
        resetPolicy: NumberSeriesResetPolicy.CALENDAR_YEAR,
        startAt: 1,
        padding: 4,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.numberSeriesCounter.deleteMany({
      where: {
        series: {
          tenantId,
          companyId,
          key: "MDM_TEST_DOC",
        },
      },
    });

    await prisma.numberSeries.deleteMany({
      where: {
        tenantId,
        companyId,
        key: "MDM_TEST_DOC",
      },
    });
  });

  it("allocates unique monotonic values under concurrent requests", async () => {
    const allocations = await Promise.all(
      Array.from({ length: 20 }).map(() =>
        allocateMasterSeriesNumber(ctx, "MDM_TEST_DOC", {
          date: new Date("2026-02-01T00:00:00.000Z"),
        }),
      ),
    );

    const values = allocations.map((entry) => entry.value);
    const unique = new Set(values);

    expect(unique.size).toBe(20);

    const sorted = [...values].sort((a, b) => a - b);
    expect(sorted[0]).toBe(1);
    expect(sorted[sorted.length - 1]).toBe(20);
  });
});
