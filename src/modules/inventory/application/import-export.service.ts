import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/domain/inventory/sku";
import { exportJobSchema, importJobSchema } from "@/modules/inventory/application/schemas";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { writeInventoryAudit } from "@/modules/inventory/infrastructure/audit-log";
import { detectQueueCapability } from "@/modules/inventory/infrastructure/queue";

type GenericRow = Record<string, string>;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function parseCsvPayload(payload: string): GenericRow[] {
  const lines = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => normalizeKey(h));
  const rows: GenericRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row: GenericRow = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function parseXlsxBase64Payload(payload: string): GenericRow[] {
  const buffer = Buffer.from(payload, "base64");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
    defval: "",
  });

  return records.map((record) => {
    const row: GenericRow = {};
    for (const [key, value] of Object.entries(record)) {
      row[normalizeKey(key)] = String(value ?? "");
    }
    return row;
  });
}

function parsePayloadToRows(payload: string, fileName: string): GenericRow[] {
  if (!payload.trim()) return [];

  if (fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")) {
    return parseXlsxBase64Payload(payload);
  }

  return parseCsvPayload(payload);
}

function toInt(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

type PreviewResult = {
  rowCount: number;
  errorCount: number;
  errors: Array<{ rowNumber: number; field?: string; message: string; rawData?: Record<string, string> }>;
  summary: Record<string, unknown>;
};

function validateRows(entity: string, rows: GenericRow[]): PreviewResult {
  const errors: PreviewResult["errors"] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (entity === "ITEMS") {
      if (!row.sku) errors.push({ rowNumber, field: "sku", message: "sku is required", rawData: row });
      if (!row.name) errors.push({ rowNumber, field: "name", message: "name is required", rawData: row });
      if (!row.brand && !row.brand_name) {
        errors.push({ rowNumber, field: "brand", message: "brand is required", rawData: row });
      }
    }

    if (entity === "OPENING_BALANCES") {
      if (!row.sku) errors.push({ rowNumber, field: "sku", message: "sku is required", rawData: row });
      if (!row.warehouse) {
        errors.push({ rowNumber, field: "warehouse", message: "warehouse is required", rawData: row });
      }
      if (!row.qty && row.qty !== "0") {
        errors.push({ rowNumber, field: "qty", message: "qty is required", rawData: row });
      }
    }

    if (entity === "REORDER_RULES") {
      if (!row.sku) errors.push({ rowNumber, field: "sku", message: "sku is required", rawData: row });
      if (!row.warehouse) {
        errors.push({ rowNumber, field: "warehouse", message: "warehouse is required", rawData: row });
      }
      if (!row.reorder_point && row.reorder_point !== "0") {
        errors.push({ rowNumber, field: "reorder_point", message: "reorder_point is required", rawData: row });
      }
    }
  });

  return {
    rowCount: rows.length,
    errorCount: errors.length,
    errors,
    summary: {
      entity,
      rows: rows.length,
      validRows: Math.max(rows.length - errors.length, 0),
      invalidRows: errors.length,
    },
  };
}

export async function createImportJob(ctx: InventoryRequestContext, input: unknown) {
  const parsed = importJobSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid import job payload", parsed.error.flatten());
  }

  const queue = await detectQueueCapability();

  const job = await prisma.inventoryImportJob.create({
    data: {
      companyId: ctx.companyId,
      entity: parsed.data.entity,
      status: "PENDING",
      fileName: parsed.data.fileName,
      storageKey: null,
      summary: {
        queueProvider: queue.provider,
        queued: queue.enabled,
      },
      createdBy: ctx.userId,
    },
  });

  await writeInventoryAudit(ctx, {
    action: "IMPORT_JOB_CREATED",
    entityType: "InventoryImportJob",
    entityId: job.id,
    after: job,
  });

  return {
    ...job,
    queue,
  };
}

export async function previewImportJob(
  ctx: InventoryRequestContext,
  params: { jobId: string; payload: string },
) {
  const job = await prisma.inventoryImportJob.findFirst({
    where: { id: params.jobId, companyId: ctx.companyId },
  });

  if (!job) {
    throw new InventoryError("NOT_FOUND", "Import job not found");
  }

  const rows = parsePayloadToRows(params.payload, job.fileName);
  const preview = validateRows(job.entity, rows);

  await prisma.$transaction(async (tx) => {
    await tx.inventoryImportJobRowError.deleteMany({ where: { jobId: job.id } });

    if (preview.errors.length > 0) {
      await tx.inventoryImportJobRowError.createMany({
        data: preview.errors.map((error) => ({
          jobId: job.id,
          rowNumber: error.rowNumber,
          field: error.field,
          message: error.message,
          rawData: error.rawData,
        })),
      });
    }

    await tx.inventoryImportJob.update({
      where: { id: job.id },
      data: {
        status: "VALIDATED",
        summary: ({
          ...(job.summary as Record<string, unknown> | null),
          ...preview.summary,
        } as unknown) as Prisma.InputJsonValue,
      },
    });
  });

  return preview;
}

export async function commitImportJob(
  ctx: InventoryRequestContext,
  params: { jobId: string; payload: string },
) {
  const job = await prisma.inventoryImportJob.findFirst({
    where: { id: params.jobId, companyId: ctx.companyId },
  });

  if (!job) {
    throw new InventoryError("NOT_FOUND", "Import job not found");
  }

  const existingErrors = await prisma.inventoryImportJobRowError.findMany({ where: { jobId: job.id }, take: 1 });
  if (existingErrors.length > 0) {
    throw new InventoryError("CONFLICT", "Import job has validation errors. Resolve preview errors before commit.");
  }

  const rows = parsePayloadToRows(params.payload, job.fileName);

  const result = await prisma.$transaction(async (tx) => {
    await tx.inventoryImportJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    let processed = 0;

    if (job.entity === "ITEMS") {
      for (const row of rows) {
        if (!row.sku || !row.name) continue;
        const brandName = row.brand || row.brand_name || "DEFAULT";
        const brand = await tx.brand.upsert({
          where: { companyId_name: { companyId: ctx.companyId, name: brandName } },
          create: { companyId: ctx.companyId, name: brandName },
          update: {},
        });

        const normalized = normalizeSku(row.sku);

        await tx.product.upsert({
          where: {
            companyId_brandId_normalizedSku: {
              companyId: ctx.companyId,
              brandId: brand.id,
              normalizedSku: normalized,
            },
          },
          create: {
            companyId: ctx.companyId,
            brandId: brand.id,
            sku: row.sku,
            normalizedSku: normalized,
            name: row.name,
            title: row.name,
            description: row.description || null,
            uom: row.uom || "pcs",
            unitCostMinor: toInt(row.unit_cost_minor || row.unit_cost || "0"),
            priceCents: toInt(row.price_cents || row.price || "0"),
            lowStockThreshold: row.low_stock_threshold ? toInt(row.low_stock_threshold) : null,
            isActive: row.is_active ? row.is_active !== "false" : true,
          },
          update: {
            name: row.name,
            title: row.name,
            description: row.description || null,
            uom: row.uom || "pcs",
            unitCostMinor: toInt(row.unit_cost_minor || row.unit_cost || "0"),
            priceCents: toInt(row.price_cents || row.price || "0"),
            lowStockThreshold: row.low_stock_threshold ? toInt(row.low_stock_threshold) : null,
            isActive: row.is_active ? row.is_active !== "false" : true,
          },
        });

        processed += 1;
      }
    }

    if (job.entity === "OPENING_BALANCES") {
      for (const row of rows) {
        if (!row.sku || !row.warehouse) continue;

        const warehouse = await tx.inventoryWarehouse.findUnique({
          where: {
            companyId_code: {
              companyId: ctx.companyId,
              code: row.warehouse,
            },
          },
          select: { id: true },
        });

        if (!warehouse) continue;

        const item = await tx.product.findFirst({
          where: {
            companyId: ctx.companyId,
            OR: [{ sku: row.sku }, { normalizedSku: normalizeSku(row.sku) }],
          },
          select: { id: true },
        });

        if (!item) continue;

        const qty = toInt(row.qty);
        const unitCost = toInt(row.unit_cost_minor || row.unit_cost || "0");

        const existingBalance = await tx.inventoryStockBalance.findFirst({
          where: {
            companyId: ctx.companyId,
            itemId: item.id,
            warehouseId: warehouse.id,
            locationId: null,
          },
          select: { id: true },
        });

        if (existingBalance) {
          await tx.inventoryStockBalance.update({
            where: { id: existingBalance.id },
            data: {
              onHand: qty,
              avgCostMinor: unitCost,
            },
          });
        } else {
          await tx.inventoryStockBalance.create({
            data: {
              companyId: ctx.companyId,
              itemId: item.id,
              warehouseId: warehouse.id,
              locationId: null,
              onHand: qty,
              avgCostMinor: unitCost,
            },
          });
        }

        await tx.inventoryLedgerEntry.create({
          data: {
            companyId: ctx.companyId,
            itemId: item.id,
            warehouseId: warehouse.id,
            locationId: null,
            quantityDelta: qty,
            unitCostMinor: unitCost,
            totalCostMinor: qty * unitCost,
            currency: "BDT",
            metadata: {
              source: "IMPORT_OPENING_BALANCES",
              importJobId: job.id,
            },
            createdBy: ctx.userId,
          },
        });

        processed += 1;
      }
    }

    if (job.entity === "REORDER_RULES") {
      for (const row of rows) {
        if (!row.sku || !row.warehouse) continue;

        const warehouse = await tx.inventoryWarehouse.findUnique({
          where: {
            companyId_code: {
              companyId: ctx.companyId,
              code: row.warehouse,
            },
          },
          select: { id: true },
        });
        if (!warehouse) continue;

        const item = await tx.product.findFirst({
          where: {
            companyId: ctx.companyId,
            OR: [{ sku: row.sku }, { normalizedSku: normalizeSku(row.sku) }],
          },
          select: { id: true },
        });
        if (!item) continue;

        const existingRule = await tx.inventoryReorderRule.findFirst({
          where: {
            companyId: ctx.companyId,
            itemId: item.id,
            warehouseId: warehouse.id,
            locationId: null,
          },
          select: { id: true },
        });

        const ruleData = {
          minQty: toInt(row.min_qty || "0"),
          maxQty: toInt(row.max_qty || "0"),
          reorderPoint: toInt(row.reorder_point || "0"),
          reorderQty: toInt(row.reorder_qty || "0"),
          leadTimeDays: toInt(row.lead_time_days || "0"),
          isActive: row.is_active ? row.is_active !== "false" : true,
        };

        if (existingRule) {
          await tx.inventoryReorderRule.update({
            where: { id: existingRule.id },
            data: ruleData,
          });
        } else {
          await tx.inventoryReorderRule.create({
            data: {
              companyId: ctx.companyId,
              itemId: item.id,
              warehouseId: warehouse.id,
              locationId: null,
              createdBy: ctx.userId,
              ...ruleData,
            },
          });
        }

        processed += 1;
      }
    }

    const updated = await tx.inventoryImportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        summary: {
          ...(job.summary as Record<string, unknown> | null),
          processed,
          committedAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  });

  await writeInventoryAudit(ctx, {
    action: "IMPORT_JOB_COMMITTED",
    entityType: "InventoryImportJob",
    entityId: job.id,
    after: result,
  });

  return result;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";

  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows
    .map((row) =>
      keys
        .map((key) => {
          const raw = row[key] == null ? "" : String(row[key]);
          const escaped = raw.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(","),
    )
    .join("\n");

  return `${header}\n${body}`;
}

export async function createExportJob(ctx: InventoryRequestContext, input: unknown) {
  const parsed = exportJobSchema.safeParse(input);
  if (!parsed.success) {
    throw new InventoryError("VALIDATION_ERROR", "Invalid export job payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const rows: Array<Record<string, unknown>> = [];

  if (payload.entity === "ITEMS") {
    const items = await prisma.product.findMany({
      where: { companyId: ctx.companyId },
      include: { brand: true, category: true },
      orderBy: { createdAt: "desc" },
    });

    for (const item of items) {
      rows.push({
        id: item.id,
        sku: item.sku,
        name: item.name,
        brand: item.brand.name,
        category: item.category?.name ?? "",
        uom: item.uom,
        unitCostMinor: item.unitCostMinor ?? 0,
        priceCents: item.priceCents,
        isActive: item.isActive,
      });
    }
  }

  if (payload.entity === "MOVEMENTS") {
    const movements = await prisma.inventoryLedgerEntry.findMany({
      where: { companyId: ctx.companyId },
      include: { item: true, warehouse: true, location: true },
      orderBy: { postingTime: "desc" },
      take: 10000,
    });

    for (const movement of movements) {
      rows.push({
        id: movement.id,
        postingTime: movement.postingTime.toISOString(),
        itemSku: movement.item.sku,
        itemName: movement.item.name,
        warehouse: movement.warehouse.code,
        location: movement.location?.code ?? "",
        quantityDelta: movement.quantityDelta,
        unitCostMinor: movement.unitCostMinor ?? 0,
      });
    }
  }

  if (payload.entity === "DOCUMENTS") {
    const docs = await prisma.inventoryDocument.findMany({
      where: { companyId: ctx.companyId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    for (const doc of docs) {
      rows.push({
        id: doc.id,
        number: doc.number,
        type: doc.documentType,
        status: doc.status,
        lines: doc.lines.length,
        createdAt: doc.createdAt.toISOString(),
        postedAt: doc.postedAt?.toISOString() ?? "",
      });
    }
  }

  if (payload.entity === "REORDER") {
    const rules = await prisma.inventoryReorderRule.findMany({
      where: { companyId: ctx.companyId },
      include: { item: true, warehouse: true },
      orderBy: { updatedAt: "desc" },
      take: 10000,
    });

    for (const rule of rules) {
      rows.push({
        id: rule.id,
        sku: rule.item.sku,
        item: rule.item.name,
        warehouse: rule.warehouse.code,
        reorderPoint: rule.reorderPoint,
        reorderQty: rule.reorderQty,
        minQty: rule.minQty,
        maxQty: rule.maxQty,
        leadTimeDays: rule.leadTimeDays,
      });
    }
  }

  const csv = toCsv(rows);

  const job = await prisma.inventoryExportJob.create({
    data: {
      companyId: ctx.companyId,
      entity: payload.entity,
      status: "COMPLETED",
      format: payload.format,
      fileName: payload.fileName,
      filters: (payload.filters ?? {}) as unknown as Prisma.InputJsonValue,
      outputKey: `${ctx.companyId}/exports/${Date.now()}-${payload.fileName}`,
      createdBy: ctx.userId,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  await writeInventoryAudit(ctx, {
    action: "EXPORT_JOB_CREATED",
    entityType: "InventoryExportJob",
    entityId: job.id,
    after: { ...job, rowCount: rows.length },
  });

  return {
    job,
    rowCount: rows.length,
    contentType: "text/csv",
    content: csv,
  };
}

export async function listImportJobs(ctx: InventoryRequestContext) {
  return prisma.inventoryImportJob.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function listExportJobs(ctx: InventoryRequestContext) {
  return prisma.inventoryExportJob.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
