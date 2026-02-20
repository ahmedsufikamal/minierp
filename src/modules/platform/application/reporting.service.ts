import { ReportSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { runAccountingAdapterReport } from "@/modules/accounting/application/reporting.service";

type ReportFilters = {
  fromDate?: string;
  toDate?: string;
  status?: string;
  search?: string;
};

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function mergeFilters(defaultFilters: unknown, runFilters: Record<string, unknown> | undefined): ReportFilters {
  const source = {
    ...(typeof defaultFilters === "object" && defaultFilters != null ? (defaultFilters as Record<string, unknown>) : {}),
    ...(runFilters ?? {}),
  };

  return {
    fromDate: source.fromDate ? String(source.fromDate) : undefined,
    toDate: source.toDate ? String(source.toDate) : undefined,
    status: source.status ? String(source.status) : undefined,
    search: source.search ? String(source.search) : undefined,
  };
}

export async function listReportDefinitions(ctx: PlatformRequestContext) {
  return prisma.reportDefinition.findMany({
    where: {
      tenantId: ctx.tenantId,
      OR: [{ companyId: ctx.companyId }, { companyId: null }],
    },
    orderBy: [{ isSystem: "desc" }, { key: "asc" }],
  });
}

export async function upsertReportDefinition(
  ctx: PlatformRequestContext,
  input: {
    companyId?: string;
    key: string;
    name: string;
    description?: string;
    sourceType: ReportSourceType;
    sourceRef: string;
    schema?: Record<string, unknown>;
    defaultFilters?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  const companyId = input.companyId ?? ctx.companyId;

  if (input.sourceType === ReportSourceType.SQL) {
    throw new PlatformError("VALIDATION_ERROR", "SQL report source is reserved; use approved adapters");
  }

  return prisma.reportDefinition.upsert({
    where: {
      tenantId_companyId_key: {
        tenantId: ctx.tenantId,
        companyId,
        key: input.key,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      companyId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      schema: (input.schema ?? null) as never,
      defaultFilters: (input.defaultFilters ?? null) as never,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    update: {
      name: input.name,
      description: input.description ?? null,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      schema: (input.schema ?? null) as never,
      defaultFilters: (input.defaultFilters ?? null) as never,
      isActive: input.isActive ?? true,
      updatedBy: ctx.userId,
    },
  });
}

export async function upsertReportView(
  ctx: PlatformRequestContext,
  input: {
    reportDefinitionId: string;
    name: string;
    isDefault?: boolean;
    filters?: Record<string, unknown>;
    columns?: string[];
    sort?: Record<string, unknown>;
    visibility?: Record<string, unknown>;
  },
) {
  const report = await prisma.reportDefinition.findUnique({
    where: { id: input.reportDefinitionId },
    select: { id: true, tenantId: true, companyId: true },
  });

  if (!report || report.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Report definition not found");
  }

  if (report.companyId && report.companyId !== ctx.companyId && ctx.platformRole !== "SUPER_ADMIN") {
    throw new PlatformError("FORBIDDEN", "Cannot create report view for another company");
  }

  return prisma.reportView.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: report.companyId ?? ctx.companyId,
      reportDefinitionId: input.reportDefinitionId,
      name: input.name,
      ownerUserId: ctx.userId,
      isDefault: input.isDefault ?? false,
      filters: (input.filters ?? null) as never,
      columns: (input.columns ?? null) as never,
      sort: (input.sort ?? null) as never,
      visibility: (input.visibility ?? null) as never,
    },
  });
}

export async function upsertReportSchedule(
  ctx: PlatformRequestContext,
  input: {
    reportDefinitionId: string;
    name: string;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    cronExpr?: string;
    timezone?: string;
    recipients: string[];
    filters?: Record<string, unknown>;
    outputFormat: string;
    isActive?: boolean;
  },
) {
  const report = await prisma.reportDefinition.findUnique({
    where: { id: input.reportDefinitionId },
    select: { id: true, tenantId: true, companyId: true },
  });

  if (!report || report.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Report definition not found");
  }

  return prisma.reportSchedule.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: report.companyId ?? ctx.companyId,
      reportDefinitionId: input.reportDefinitionId,
      name: input.name,
      frequency: input.frequency,
      cronExpr: input.cronExpr ?? null,
      timezone: input.timezone ?? null,
      recipients: input.recipients as never,
      filters: (input.filters ?? null) as never,
      outputFormat: input.outputFormat,
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
    },
  });
}

async function runAdapterReport(
  ctx: PlatformRequestContext,
  input: {
    sourceRef: string;
    filters: ReportFilters;
    page: number;
    pageSize: number;
  },
): Promise<{ rows: unknown[]; total: number }> {
  const skip = (input.page - 1) * input.pageSize;
  const from = parseDate(input.filters.fromDate);
  const to = parseDate(input.filters.toDate);

  switch (input.sourceRef) {
    case "sales.invoices": {
      const where = {
        companyId: ctx.companyId,
        ...(input.filters.status ? { status: input.filters.status as never } : {}),
        ...(from || to
          ? {
              invoiceDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.salesInvoice.findMany({
          where,
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { invoiceDate: "desc" },
          skip,
          take: input.pageSize,
        }),
        prisma.salesInvoice.count({ where }),
      ]);

      return { rows, total };
    }

    case "buying.bills": {
      const where = {
        companyId: ctx.companyId,
        ...(input.filters.status ? { status: input.filters.status as never } : {}),
        ...(from || to
          ? {
              billDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.purchaseBill.findMany({
          where,
          include: { vendor: { select: { id: true, name: true } } },
          orderBy: { billDate: "desc" },
          skip,
          take: input.pageSize,
        }),
        prisma.purchaseBill.count({ where }),
      ]);

      return { rows, total };
    }

    case "inventory.documents": {
      const where = {
        companyId: ctx.companyId,
        ...(input.filters.status ? { status: input.filters.status as never } : {}),
        ...(from || to
          ? {
              documentDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.inventoryDocument.findMany({
          where,
          orderBy: { documentDate: "desc" },
          skip,
          take: input.pageSize,
        }),
        prisma.inventoryDocument.count({ where }),
      ]);

      return { rows, total };
    }

    case "inventory.ledger": {
      const where = {
        companyId: ctx.companyId,
        ...(from || to
          ? {
              postingTime: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.inventoryLedgerEntry.findMany({
          where,
          orderBy: { postingTime: "desc" },
          skip,
          take: input.pageSize,
        }),
        prisma.inventoryLedgerEntry.count({ where }),
      ]);

      return { rows, total };
    }

    case "platform.audit": {
      const where = {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(input.filters.search
          ? {
              OR: [
                { action: { contains: input.filters.search, mode: "insensitive" as const } },
                { entityType: { contains: input.filters.search, mode: "insensitive" as const } },
                { entityId: { contains: input.filters.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };

      const [rows, total] = await Promise.all([
        prisma.auditEvent.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: input.pageSize,
        }),
        prisma.auditEvent.count({ where }),
      ]);

      return { rows, total };
    }

    case "accounting.trial-balance":
    case "accounting.profit-loss":
    case "accounting.balance-sheet":
      return runAccountingAdapterReport(ctx, input);

    default:
      throw new PlatformError(
        "VALIDATION_ERROR",
        `Unsupported report source '${input.sourceRef}'. Allowed sources: sales.invoices, buying.bills, inventory.documents, inventory.ledger, platform.audit, accounting.trial-balance, accounting.profit-loss, accounting.balance-sheet`,
      );
  }
}

export async function runReport(
  ctx: PlatformRequestContext,
  input: {
    reportDefinitionId: string;
    filters?: Record<string, unknown>;
    page: number;
    pageSize: number;
  },
) {
  const definition = await prisma.reportDefinition.findUnique({
    where: { id: input.reportDefinitionId },
  });

  if (!definition || definition.tenantId !== ctx.tenantId) {
    throw new PlatformError("NOT_FOUND", "Report definition not found");
  }

  if (definition.companyId && definition.companyId !== ctx.companyId && ctx.platformRole !== "SUPER_ADMIN") {
    throw new PlatformError("FORBIDDEN", "Cannot run report for another company");
  }

  if (definition.sourceType !== ReportSourceType.ADAPTER) {
    throw new PlatformError("VALIDATION_ERROR", "Only adapter-backed reports are enabled");
  }

  const filters = mergeFilters(definition.defaultFilters, input.filters);
  const result = await runAdapterReport(ctx, {
    sourceRef: definition.sourceRef,
    filters,
    page: input.page,
    pageSize: input.pageSize,
  });

  return {
    definition: {
      id: definition.id,
      key: definition.key,
      name: definition.name,
      sourceRef: definition.sourceRef,
    },
    filters,
    page: input.page,
    pageSize: input.pageSize,
    total: result.total,
    rows: result.rows,
  };
}
