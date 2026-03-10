import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const mocks = vi.hoisted(() => ({
  prisma: {
    brand: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  commitBrandImportRows,
  previewBrandImportFile,
} from "@/modules/inventory/application/brand-import.service";

function makeWorkbookFile(rows: unknown[][], fileName = "brands.xlsx") {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Brands");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

afterEach(() => {
  mocks.prisma.brand.findMany.mockReset();
  mocks.prisma.brand.createMany.mockReset();
  mocks.prisma.brand.findFirst.mockReset();
  mocks.prisma.brand.create.mockReset();
});

describe("brand import preview", () => {
  it("rejects non-excel files", async () => {
    const file = new File(["brand"], "brands.csv", { type: "text/csv" });

    const result = await previewBrandImportFile({
      companyId: "company-1",
      file,
    });

    expect(result).toEqual({
      ok: false,
      error: "Please upload an Excel file (.xlsx or .xls).",
    });
  });

  it("rejects an empty workbook", async () => {
    mocks.prisma.brand.findMany.mockResolvedValue([]);

    const result = await previewBrandImportFile({
      companyId: "company-1",
      file: makeWorkbookFile([["Brand Name"]]),
    });

    expect(result).toEqual({
      ok: false,
      error: "The workbook does not contain any brand rows.",
    });
  });

  it("rejects a workbook missing the required header", async () => {
    mocks.prisma.brand.findMany.mockResolvedValue([]);

    const result = await previewBrandImportFile({
      companyId: "company-1",
      file: makeWorkbookFile([
        ["Code"],
        ["ALPHA"],
      ]),
    });

    expect(result).toEqual({
      ok: false,
      error: 'The workbook is missing the required "Brand Name" column.',
    });
  });

  it("classifies valid, invalid, file-duplicate, and existing-duplicate rows", async () => {
    mocks.prisma.brand.findMany.mockResolvedValue([{ name: "Siemens" }]);

    const result = await previewBrandImportFile({
      companyId: "company-1",
      file: makeWorkbookFile([
        ["Brand Name"],
        ["Alpha"],
        ["   "],
        ["alpha"],
        ["SIEMENS"],
        ["Beta"],
      ]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.acceptedRows).toEqual([
      { rowNumber: 2, name: "Alpha" },
      { rowNumber: 6, name: "Beta" },
    ]);
    expect(result.data.summary).toEqual({
      totalRows: 5,
      validRows: 2,
      skippedRows: 3,
      invalidRows: 1,
      duplicateInFileRows: 1,
      duplicateExistingRows: 1,
    });
    expect(result.data.rows).toEqual([
      { rowNumber: 2, brandName: "Alpha", status: "VALID", reason: null },
      { rowNumber: 3, brandName: "", status: "SKIPPED", reason: "Brand Name is required." },
      { rowNumber: 4, brandName: "alpha", status: "SKIPPED", reason: "Duplicate brand name in file." },
      { rowNumber: 5, brandName: "SIEMENS", status: "SKIPPED", reason: "Brand already exists." },
      { rowNumber: 6, brandName: "Beta", status: "VALID", reason: null },
    ]);
  });
});

describe("brand import commit", () => {
  it("skips payload duplicates and existing brands before createMany", async () => {
    mocks.prisma.brand.findMany.mockResolvedValue([{ name: "Existing" }]);
    mocks.prisma.brand.createMany.mockResolvedValue({ count: 2 });

    const result = await commitBrandImportRows({
      companyId: "company-1",
      rows: [
        { rowNumber: 2, name: "Alpha" },
        { rowNumber: 3, name: "alpha" },
        { rowNumber: 4, name: "Existing" },
        { rowNumber: 5, name: "Beta" },
      ],
    });

    expect(mocks.prisma.brand.createMany).toHaveBeenCalledWith({
      data: [
        { companyId: "company-1", name: "Alpha" },
        { companyId: "company-1", name: "Beta" },
      ],
      skipDuplicates: true,
    });
    expect(result).toEqual({
      totalRowsProcessed: 4,
      successfulImports: 2,
      skippedRows: 2,
      failedRows: [],
    });
  });

  it("falls back to row-by-row inserts and reports failures", async () => {
    mocks.prisma.brand.findMany.mockResolvedValue([]);
    mocks.prisma.brand.createMany.mockRejectedValue(new Error("chunk failed"));
    mocks.prisma.brand.findFirst.mockResolvedValue(null);
    mocks.prisma.brand.create
      .mockResolvedValueOnce({ id: "brand-1" })
      .mockRejectedValueOnce(new Error("duplicate key"));

    const result = await commitBrandImportRows({
      companyId: "company-1",
      rows: [
        { rowNumber: 2, name: "Alpha" },
        { rowNumber: 3, name: "Beta" },
      ],
    });

    expect(result).toEqual({
      totalRowsProcessed: 2,
      successfulImports: 1,
      skippedRows: 0,
      failedRows: [
        {
          rowNumber: 3,
          brandName: "Beta",
          reason: "duplicate key",
        },
      ],
    });
  });
});
