import { NumberSeriesResetPolicy } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/modules/platform/application/audit-ledger.service";
import { seedCoreMetaModels } from "@/modules/platform/application/meta-model.service";
import { applyPattern, periodKeyFor } from "@/modules/platform/application/numbering.service";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";

const masterNumberNextSchema = z.object({
  date: z.coerce.date().optional(),
  fiscalYear: z.string().trim().max(20).optional(),
  companyId: z.string().trim().optional(),
});

type LockedSeriesRow = {
  id: string;
  key: string;
  tenantId: string;
  companyId: string | null;
  pattern: string;
  resetPolicy: NumberSeriesResetPolicy;
  startAt: number;
  padding: number;
  lastResetYear: number | null;
};

export async function allocateMasterSeriesNumber(
  ctx: PlatformRequestContext,
  key: string,
  input: unknown,
): Promise<{ seriesId: string; key: string; value: number; number: string; periodKey: string }> {
  await seedCoreMetaModels(ctx);
  const parsed = masterNumberNextSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid number-series allocation payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  const date = payload.date ?? new Date();
  const targetCompanyId = payload.companyId?.trim() || ctx.companyId;

  const series = await prisma.numberSeries.findFirst({
    where: {
      tenantId: ctx.tenantId,
      key,
      isActive: true,
      OR: [{ companyId: targetCompanyId }, { companyId: null }],
    },
    orderBy: [{ companyId: "desc" }, { updatedAt: "desc" }],
    select: { id: true },
  });

  if (!series) {
    throw new PlatformError("NOT_FOUND", `Number series '${key}' not found`);
  }

  const allocated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedSeriesRow[]>`
      SELECT
        "id",
        "key",
        "tenantId",
        "companyId",
        "pattern",
        "resetPolicy",
        "startAt",
        "padding",
        "lastResetYear"
      FROM "NumberSeries"
      WHERE "id" = ${series.id}
      FOR UPDATE
    `;

    const locked = rows[0];
    if (!locked) {
      throw new PlatformError("NOT_FOUND", `Number series '${key}' no longer exists`);
    }

    const currentYear = date.getUTCFullYear();
    let fiscalYear = payload.fiscalYear;
    if (!fiscalYear && locked.resetPolicy === NumberSeriesResetPolicy.FISCAL_YEAR) {
      fiscalYear = String(currentYear);
    }

    if (
      (locked.resetPolicy === NumberSeriesResetPolicy.CALENDAR_YEAR ||
        locked.resetPolicy === NumberSeriesResetPolicy.FISCAL_YEAR) &&
      locked.lastResetYear !== currentYear
    ) {
      await tx.numberSeries.update({
        where: { id: locked.id },
        data: { lastResetYear: currentYear },
      });
    }

    const periodKey = periodKeyFor({
      date,
      fiscalYear,
      resetPolicy: locked.resetPolicy,
    });

    await tx.numberSeriesCounter.upsert({
      where: {
        seriesId_periodKey: {
          seriesId: locked.id,
          periodKey,
        },
      },
      create: {
        seriesId: locked.id,
        periodKey,
        currentValue: locked.startAt - 1,
      },
      update: {},
    });

    const counter = await tx.numberSeriesCounter.update({
      where: {
        seriesId_periodKey: {
          seriesId: locked.id,
          periodKey,
        },
      },
      data: {
        currentValue: { increment: 1 },
      },
      select: {
        currentValue: true,
      },
    });

    const [tenant, company] = await Promise.all([
      tx.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { key: true },
      }),
      locked.companyId
        ? tx.company.findUnique({
            where: { id: locked.companyId },
            select: { slug: true },
          })
        : Promise.resolve(null),
    ]);

    const formatted = applyPattern({
      pattern: locked.pattern,
      sequence: counter.currentValue,
      padding: locked.padding,
      tenantKey: tenant?.key ?? null,
      companyCode: company?.slug ?? null,
      fiscalYear,
      date,
    });

    return {
      seriesId: locked.id,
      key: locked.key,
      value: counter.currentValue,
      number: formatted,
      periodKey,
    };
  });

  await appendAuditEvent(ctx, {
    source: "master.number-series",
    action: "master.number-series.next",
    entityType: "NumberSeries",
    entityId: allocated.seriesId,
    metadata: {
      key: allocated.key,
      periodKey: allocated.periodKey,
      value: allocated.value,
    },
  });

  return allocated;
}
