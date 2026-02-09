import { describe, it, expect, vi, beforeEach } from "vitest";
import { previewImport, executeImport } from "../import-service";

const repoMock = {
  findSnapshotByHash: vi.fn(),
  createSnapshot: vi.fn(),
  updateSnapshot: vi.fn(),
};

vi.mock("@/infrastructure/inventory/repository", () => ({
  inventoryRepo: () => repoMock,
}));

vi.mock("@/lib/excel-import", () => ({
  computeFileHash: vi.fn(async () => "hash-1"),
  parseExcelFile: vi.fn(() => ({
    totalSummary: [],
    locations: [],
    errors: [],
    warnings: [],
  })),
  parseQty: vi.fn(),
  parseStoreLocations: vi.fn(),
  allocateQtyToLocations: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brand: {
      findFirst: vi.fn(async () => null),
    },
    $transaction: vi.fn(async (cb: any) => cb({})),
  },
}));

function makeFile(name = "test.xlsx") {
  return {
    name,
    arrayBuffer: async () => new ArrayBuffer(8),
  } as File;
}

describe("import-service", () => {
  beforeEach(() => {
    repoMock.findSnapshotByHash.mockReset();
    repoMock.createSnapshot.mockReset();
    repoMock.updateSnapshot.mockReset();
  });

  it("blocks executeImport when snapshot already imported", async () => {
    repoMock.findSnapshotByHash.mockResolvedValue({
      id: "snap-1",
      status: "IMPORTED",
      importedAt: new Date("2024-01-01T00:00:00Z"),
    });

    const res = await executeImport({
      companyId: "c1",
      file: makeFile(),
      forceReimport: false,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("already imported");
    }
  });

  it("creates snapshot on preview when none exists", async () => {
    repoMock.findSnapshotByHash.mockResolvedValue(null);
    repoMock.createSnapshot.mockResolvedValue({ id: "snap-2" });

    const res = await previewImport({
      companyId: "c1",
      file: makeFile(),
      actorId: "u1",
    });

    expect(res.ok).toBe(true);
    expect(repoMock.createSnapshot).toHaveBeenCalled();
  });
});
