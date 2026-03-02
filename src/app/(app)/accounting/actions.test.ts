import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCompanyIdOrUserId: vi.fn(),
  revalidatePath: vi.fn(),
  accountFindFirst: vi.fn(),
  accountFindMany: vi.fn(),
  accountCount: vi.fn(),
  accountDelete: vi.fn(),
  journalEntryFindFirst: vi.fn(),
  journalEntryDelete: vi.fn(),
  journalLineCount: vi.fn(),
  glEntryCount: vi.fn(),
  paymentEntryCount: vi.fn(),
  supplierPaymentCount: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCompanyIdOrUserId: mocks.getCompanyIdOrUserId,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findFirst: mocks.accountFindFirst,
      findMany: mocks.accountFindMany,
      count: mocks.accountCount,
      delete: mocks.accountDelete,
    },
    journalEntry: {
      findFirst: mocks.journalEntryFindFirst,
      delete: mocks.journalEntryDelete,
    },
    journalLine: {
      count: mocks.journalLineCount,
    },
    gLEntry: {
      count: mocks.glEntryCount,
    },
    paymentEntry: {
      count: mocks.paymentEntryCount,
    },
    supplierPayment: {
      count: mocks.supplierPaymentCount,
    },
  },
}));

import { deleteAccount, deleteJournalEntry } from "./actions";

beforeEach(() => {
  mocks.getCompanyIdOrUserId.mockResolvedValue("company-1");
  mocks.accountFindFirst.mockReset();
  mocks.accountFindMany.mockReset();
  mocks.accountCount.mockReset();
  mocks.accountDelete.mockReset();
  mocks.journalEntryFindFirst.mockReset();
  mocks.journalEntryDelete.mockReset();
  mocks.journalLineCount.mockReset();
  mocks.glEntryCount.mockReset();
  mocks.paymentEntryCount.mockReset();
  mocks.supplierPaymentCount.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("deleteAccount", () => {
  it("blocks deleting a group account with children", async () => {
    mocks.accountFindFirst.mockResolvedValue({ id: "acct-1", isGroup: true });
    mocks.accountCount.mockResolvedValue(2);
    mocks.journalLineCount.mockResolvedValue(0);
    mocks.glEntryCount.mockResolvedValue(0);
    mocks.paymentEntryCount.mockResolvedValue(0);
    mocks.supplierPaymentCount.mockResolvedValue(0);

    await expect(deleteAccount("acct-1")).resolves.toEqual({
      ok: false,
      error: "Cannot delete a group account while it still has child accounts.",
    });

    expect(mocks.accountDelete).not.toHaveBeenCalled();
  });

  it("blocks deleting a referenced posting account", async () => {
    mocks.accountFindFirst.mockResolvedValue({ id: "acct-1", isGroup: false });
    mocks.accountCount.mockResolvedValue(0);
    mocks.journalLineCount.mockResolvedValue(0);
    mocks.glEntryCount.mockResolvedValue(1);
    mocks.paymentEntryCount.mockResolvedValue(0);
    mocks.supplierPaymentCount.mockResolvedValue(0);

    await expect(deleteAccount("acct-1")).resolves.toEqual({
      ok: false,
      error: "Cannot delete an account that is already referenced by transactions.",
    });

    expect(mocks.accountDelete).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced leaf account and revalidates the UI", async () => {
    mocks.accountFindFirst.mockResolvedValue({ id: "acct-1", isGroup: false });
    mocks.accountCount.mockResolvedValue(0);
    mocks.journalLineCount.mockResolvedValue(0);
    mocks.glEntryCount.mockResolvedValue(0);
    mocks.paymentEntryCount.mockResolvedValue(0);
    mocks.supplierPaymentCount.mockResolvedValue(0);
    mocks.accountDelete.mockResolvedValue({ id: "acct-1" });

    await expect(deleteAccount("acct-1")).resolves.toEqual({ ok: true });

    expect(mocks.accountDelete).toHaveBeenCalledWith({ where: { id: "acct-1" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/accounting");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});

describe("deleteJournalEntry", () => {
  it("blocks deleting a non-draft journal entry", async () => {
    mocks.journalEntryFindFirst.mockResolvedValue({ id: "je-1", status: "SUBMITTED" });

    await expect(deleteJournalEntry("je-1")).resolves.toEqual({
      ok: false,
      error: "Only draft journal entries can be deleted.",
    });

    expect(mocks.journalEntryDelete).not.toHaveBeenCalled();
  });

  it("deletes a draft journal entry without posted GL rows", async () => {
    mocks.journalEntryFindFirst.mockResolvedValue({ id: "je-1", status: "DRAFT" });
    mocks.glEntryCount.mockResolvedValue(0);
    mocks.journalEntryDelete.mockResolvedValue({ id: "je-1" });

    await expect(deleteJournalEntry("je-1")).resolves.toEqual({ ok: true });

    expect(mocks.glEntryCount).toHaveBeenCalledWith({
      where: { companyId: "company-1", journalEntryId: "je-1" },
    });
    expect(mocks.journalEntryDelete).toHaveBeenCalledWith({ where: { id: "je-1" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/accounting");
  });
});
