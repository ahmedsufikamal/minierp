import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeServerActionPermission: vi.fn(),
  previewImport: vi.fn(),
  executeImport: vi.fn(),
  revalidatePath: vi.fn(),
  prisma: {
    inventoryMove: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    brand: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    category: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  authorizeServerActionPermission: mocks.authorizeServerActionPermission,
}));

vi.mock("@/application/inventory/import-service", () => ({
  previewImport: mocks.previewImport,
  executeImport: mocks.executeImport,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { previewExcelImport, executeExcelImport } from "@/app/(app)/inventory/import-actions";
import { createMove, deleteMove } from "@/app/(app)/inventory/actions";
import { createBrand, deleteBrand } from "@/app/(app)/inventory/brands/actions";
import { createCategory, deleteCategory } from "@/app/(app)/inventory/categories/actions";

afterEach(() => {
  mocks.authorizeServerActionPermission.mockReset();
  mocks.previewImport.mockReset();
  mocks.executeImport.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.prisma.inventoryMove.create.mockReset();
  mocks.prisma.inventoryMove.deleteMany.mockReset();
  mocks.prisma.brand.upsert.mockReset();
  mocks.prisma.brand.deleteMany.mockReset();
  mocks.prisma.category.upsert.mockReset();
  mocks.prisma.category.deleteMany.mockReset();
});

describe("inventory import action permissions", () => {
  it("denies preview when inventory.import.read is missing", async () => {
    mocks.authorizeServerActionPermission.mockResolvedValue({ allowed: false, context: null });

    const result = await previewExcelImport(new FormData());

    expect(mocks.authorizeServerActionPermission).toHaveBeenCalledWith({
      iamPermission: "inventory.import.read",
      legacyPermission: "inventory:read",
    });
    expect(result).toEqual({ ok: false, error: "Not authorized to preview inventory imports." });
    expect(mocks.previewImport).not.toHaveBeenCalled();
  });

  it("allows preview when inventory.import.read is granted", async () => {
    mocks.authorizeServerActionPermission.mockResolvedValue({
      allowed: true,
      context: {
        userId: "user-1",
        companyId: "company-1",
        role: "OWNER",
        permissions: ["inventory.import.read"],
      },
    });
    mocks.previewImport.mockResolvedValue({ ok: true, data: { summary: { totalItems: 1 } } });

    const formData = new FormData();
    formData.append("file", new File(["xlsx"], "items.xlsx"));

    const result = await previewExcelImport(formData);

    expect(result.ok).toBe(true);
    expect(mocks.previewImport).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        actorId: "user-1",
      }),
    );
  });

  it("denies execute when inventory.import.write is missing", async () => {
    mocks.authorizeServerActionPermission.mockResolvedValue({ allowed: false, context: null });

    const result = await executeExcelImport(new FormData());

    expect(mocks.authorizeServerActionPermission).toHaveBeenCalledWith({
      iamPermission: "inventory.import.write",
      legacyPermission: "inventory:write",
    });
    expect(result).toEqual({ ok: false, error: "Not authorized to execute inventory imports." });
    expect(mocks.executeImport).not.toHaveBeenCalled();
  });

  it("allows execute when inventory.import.write is granted", async () => {
    mocks.authorizeServerActionPermission.mockResolvedValue({
      allowed: true,
      context: {
        userId: "user-2",
        companyId: "company-2",
        role: "OWNER",
        permissions: ["inventory.import.write"],
      },
    });
    mocks.executeImport.mockResolvedValue({ ok: true, snapshotId: "snap-1" });

    const formData = new FormData();
    formData.append("file", new File(["xlsx"], "items.xlsx"));

    const result = await executeExcelImport(formData);

    expect(result).toEqual({ ok: true, snapshotId: "snap-1" });
    expect(mocks.executeImport).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-2",
        actorId: "user-2",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inventory");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inventory/import");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inventory/items");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inventory/locations");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inventory/snapshots");
  });
});

describe("inventory write action permissions", () => {
  it("denies unauthorized createMove and blocks legacy move writes", async () => {
    const formData = new FormData();
    formData.append("productId", "prod-1");
    formData.append("type", "IN");
    formData.append("qty", "5");
    formData.append("note", "test");

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({ allowed: false, context: null });
    const denied = await createMove(formData);
    expect(denied).toEqual({ ok: false, error: "Not authorized to create inventory moves." });
    expect(mocks.prisma.inventoryMove.create).not.toHaveBeenCalled();

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({
      allowed: true,
      context: { userId: "u1", companyId: "c1", role: "ADMIN", permissions: ["inventory.write"] },
    });
    const allowed = await createMove(formData);
    expect(allowed).toEqual({
      ok: false,
      error:
        "Legacy InventoryMove writes are disabled. Post stock through Inventory Documents (/stock/documents).",
    });
    expect(mocks.authorizeServerActionPermission).toHaveBeenLastCalledWith({
      iamPermission: "inventory.write",
      legacyPermission: "inventory:write",
    });
    expect(mocks.prisma.inventoryMove.create).not.toHaveBeenCalled();
  });

  it("denies unauthorized deleteMove and blocks legacy delete path", async () => {
    mocks.authorizeServerActionPermission.mockResolvedValueOnce({ allowed: false, context: null });
    const denied = await deleteMove("move-1");
    expect(denied).toEqual({ ok: false, error: "Not authorized to delete inventory moves." });
    expect(mocks.prisma.inventoryMove.deleteMany).not.toHaveBeenCalled();

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({
      allowed: true,
      context: { userId: "u1", companyId: "c1", role: "ADMIN", permissions: ["inventory.write"] },
    });
    const allowed = await deleteMove("move-1");
    expect(allowed).toEqual({
      ok: false,
      error:
        "Legacy InventoryMove writes are disabled. Reverse/correct stock through Inventory Documents.",
    });
    expect(mocks.prisma.inventoryMove.deleteMany).not.toHaveBeenCalled();
  });

  it("denies and allows brand actions by inventory.write", async () => {
    const formData = new FormData();
    formData.append("name", "Brand X");

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({ allowed: false, context: null });
    await createBrand(formData);
    expect(mocks.prisma.brand.upsert).not.toHaveBeenCalled();

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({
      allowed: true,
      context: { userId: "u1", companyId: "c1", role: "ADMIN", permissions: ["inventory.write"] },
    });
    await createBrand(formData);
    expect(mocks.prisma.brand.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_name: { companyId: "c1", name: "Brand X" } },
      }),
    );

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({ allowed: false, context: null });
    await deleteBrand("brand-1");
    expect(mocks.prisma.brand.deleteMany).not.toHaveBeenCalled();

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({
      allowed: true,
      context: { userId: "u1", companyId: "c1", role: "ADMIN", permissions: ["inventory.write"] },
    });
    await deleteBrand("brand-1");
    expect(mocks.prisma.brand.deleteMany).toHaveBeenCalledWith({ where: { id: "brand-1", companyId: "c1" } });
  });

  it("denies and allows category actions by inventory.write", async () => {
    const formData = new FormData();
    formData.append("name", "Category X");

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({ allowed: false, context: null });
    await createCategory(formData);
    expect(mocks.prisma.category.upsert).not.toHaveBeenCalled();

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({
      allowed: true,
      context: { userId: "u1", companyId: "c1", role: "ADMIN", permissions: ["inventory.write"] },
    });
    await createCategory(formData);
    expect(mocks.prisma.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_name: { companyId: "c1", name: "Category X" } },
      }),
    );

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({ allowed: false, context: null });
    await deleteCategory("cat-1");
    expect(mocks.prisma.category.deleteMany).not.toHaveBeenCalled();

    mocks.authorizeServerActionPermission.mockResolvedValueOnce({
      allowed: true,
      context: { userId: "u1", companyId: "c1", role: "ADMIN", permissions: ["inventory.write"] },
    });
    await deleteCategory("cat-1");
    expect(mocks.prisma.category.deleteMany).toHaveBeenCalledWith({ where: { id: "cat-1", companyId: "c1" } });
  });
});
