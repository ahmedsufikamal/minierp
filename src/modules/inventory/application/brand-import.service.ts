import * as XLSX from "xlsx";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls"]);
const BRAND_HEADER_ALIASES = new Set(["brandname", "name", "brand"]);
const CREATE_MANY_CHUNK_SIZE = 250;

export const brandImportAcceptedRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export const brandImportAcceptedRowsSchema = z.array(brandImportAcceptedRowSchema);

export type BrandImportAcceptedRow = z.infer<typeof brandImportAcceptedRowSchema>;

export type BrandImportPreviewRow = {
  rowNumber: number;
  brandName: string;
  status: "VALID" | "SKIPPED";
  reason: string | null;
};

export type BrandImportPreview = {
  fileName: string;
  rows: BrandImportPreviewRow[];
  acceptedRows: BrandImportAcceptedRow[];
  summary: {
    totalRows: number;
    validRows: number;
    skippedRows: number;
    invalidRows: number;
    duplicateInFileRows: number;
    duplicateExistingRows: number;
  };
};

export type BrandImportCommitFailure = {
  rowNumber: number;
  brandName: string;
  reason: string;
};

export type BrandImportCommitResult = {
  totalRowsProcessed: number;
  successfulImports: number;
  skippedRows: number;
  failedRows: BrandImportCommitFailure[];
};

type BrandImportResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeBrandName(value: unknown): string {
  return String(value ?? "").trim();
}

function comparisonKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function isRowBlank(row: unknown[]): boolean {
  return row.every((cell) => normalizeBrandName(cell).length === 0);
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function getSheetRows(fileBuffer: Buffer): unknown[][] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "buffer" });
  } catch {
    throw new Error("The uploaded file could not be read as an Excel workbook.");
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The workbook does not contain any sheets.");
  }

  const firstSheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as unknown[][];
}

function resolveBrandColumn(rows: unknown[][]): { brandColumnIndex: number; dataRows: unknown[][]; headerRowIndex: number } {
  const headerRowIndex = rows.findIndex((row) => Array.isArray(row) && !isRowBlank(row));
  if (headerRowIndex < 0) {
    throw new Error("The workbook does not contain any brand rows.");
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const brandColumnIndex = headerRow.findIndex((cell) => BRAND_HEADER_ALIASES.has(normalizeHeader(cell)));
  if (brandColumnIndex < 0) {
    throw new Error('The workbook is missing the required "Brand Name" column.');
  }

  const dataRows = rows.slice(headerRowIndex + 1);
  if (dataRows.length === 0) {
    throw new Error("The workbook does not contain any brand rows.");
  }

  return { brandColumnIndex, dataRows, headerRowIndex };
}

export async function previewBrandImportFile(params: {
  companyId: string;
  file: File;
}): Promise<BrandImportResult<BrandImportPreview>> {
  const extension = getFileExtension(params.file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Please upload an Excel file (.xlsx or .xls)." };
  }

  let rows: unknown[][];
  try {
    const fileBuffer = Buffer.from(await params.file.arrayBuffer());
    rows = getSheetRows(fileBuffer);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The uploaded file could not be read as an Excel workbook.",
    };
  }

  let brandColumnIndex = -1;
  let dataRows: unknown[][] = [];
  let headerRowIndex = 0;
  try {
    const resolved = resolveBrandColumn(rows);
    brandColumnIndex = resolved.brandColumnIndex;
    dataRows = resolved.dataRows;
    headerRowIndex = resolved.headerRowIndex;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to parse the workbook.",
    };
  }

  const existingBrands = await prisma.brand.findMany({
    where: { companyId: params.companyId },
    select: { name: true },
  });
  const existingBrandKeys = new Set(
    existingBrands
      .map((brand) => comparisonKey(brand.name))
      .filter(Boolean),
  );

  const seenInFile = new Set<string>();
  const previewRows: BrandImportPreviewRow[] = [];
  const acceptedRows: BrandImportAcceptedRow[] = [];

  let invalidRows = 0;
  let duplicateInFileRows = 0;
  let duplicateExistingRows = 0;

  dataRows.forEach((row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const brandName = normalizeBrandName(row[brandColumnIndex]);
    const normalizedName = comparisonKey(brandName);

    if (!brandName) {
      invalidRows += 1;
      previewRows.push({
        rowNumber,
        brandName: "",
        status: "SKIPPED",
        reason: "Brand Name is required.",
      });
      return;
    }

    if (existingBrandKeys.has(normalizedName)) {
      duplicateExistingRows += 1;
      previewRows.push({
        rowNumber,
        brandName,
        status: "SKIPPED",
        reason: "Brand already exists.",
      });
      return;
    }

    if (seenInFile.has(normalizedName)) {
      duplicateInFileRows += 1;
      previewRows.push({
        rowNumber,
        brandName,
        status: "SKIPPED",
        reason: "Duplicate brand name in file.",
      });
      return;
    }

    seenInFile.add(normalizedName);
    acceptedRows.push({ rowNumber, name: brandName });
    previewRows.push({
      rowNumber,
      brandName,
      status: "VALID",
      reason: null,
    });
  });

  return {
    ok: true,
    data: {
      fileName: params.file.name,
      rows: previewRows,
      acceptedRows,
      summary: {
        totalRows: previewRows.length,
        validRows: acceptedRows.length,
        skippedRows: previewRows.length - acceptedRows.length,
        invalidRows,
        duplicateInFileRows,
        duplicateExistingRows,
      },
    },
  };
}

export async function commitBrandImportRows(params: {
  companyId: string;
  rows: BrandImportAcceptedRow[];
}): Promise<BrandImportCommitResult> {
  const existingBrands = await prisma.brand.findMany({
    where: { companyId: params.companyId },
    select: { name: true },
  });
  const existingBrandKeys = new Set(
    existingBrands
      .map((brand) => comparisonKey(brand.name))
      .filter(Boolean),
  );

  const seenInPayload = new Set<string>();
  const rowsToCreate: BrandImportAcceptedRow[] = [];
  let skippedRows = 0;

  for (const row of params.rows) {
    const name = normalizeBrandName(row.name);
    const normalizedName = comparisonKey(name);

    if (!name) {
      skippedRows += 1;
      continue;
    }

    if (existingBrandKeys.has(normalizedName) || seenInPayload.has(normalizedName)) {
      skippedRows += 1;
      continue;
    }

    seenInPayload.add(normalizedName);
    rowsToCreate.push({
      rowNumber: row.rowNumber,
      name,
    });
  }

  let successfulImports = 0;
  const failedRows: BrandImportCommitFailure[] = [];

  for (const chunk of chunkRows(rowsToCreate, CREATE_MANY_CHUNK_SIZE)) {
    try {
      const result = await prisma.brand.createMany({
        data: chunk.map((row) => ({ companyId: params.companyId, name: row.name })),
        skipDuplicates: true,
      });
      successfulImports += result.count;
      skippedRows += chunk.length - result.count;
    } catch {
      for (const row of chunk) {
        try {
          const existingBrand = await prisma.brand.findFirst({
            where: {
              companyId: params.companyId,
              name: { equals: row.name, mode: "insensitive" },
            },
            select: { id: true },
          });

          if (existingBrand) {
            skippedRows += 1;
            continue;
          }

          await prisma.brand.create({
            data: {
              companyId: params.companyId,
              name: row.name,
            },
          });
          successfulImports += 1;
        } catch (error) {
          failedRows.push({
            rowNumber: row.rowNumber,
            brandName: row.name,
            reason: error instanceof Error ? error.message : "Failed to create brand.",
          });
        }
      }
    }
  }

  return {
    totalRowsProcessed: params.rows.length,
    successfulImports,
    skippedRows,
    failedRows,
  };
}
