"use server";

import { JournalEntryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { handlePrismaUniqueConflict } from "@/lib/prisma-errors";

const AccountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]),
});

function toCents(input: string | undefined | null) {
  const val = Number(String(input ?? "0").replace(/,/g, ""));
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100);
}

export async function createAccount(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantId: true },
  });

  const parsed = AccountSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  try {
    await prisma.account.create({
      data: {
        companyId,
        tenantId: company?.tenantId ?? null,
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        rootType: parsed.data.type,
        isGroup: false,
      },
    });
  } catch (e) {
    const conflict = handlePrismaUniqueConflict(e, "code");
    if (conflict) return conflict;
    throw e;
  }

  revalidatePath("/accounting");
  revalidatePath("/dashboard");
  return { ok: true };
}

const EntrySchema = z.object({
  date: z.string().optional(),
  memo: z.string().optional().or(z.literal("")),
  debitAccountId: z.string().min(1),
  creditAccountId: z.string().min(1),
  amount: z.string().min(1),
});

export async function createJournalEntry(formData: FormData) {
  const companyId = await getCompanyIdOrUserId();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantId: true },
  });

  const parsed = EntrySchema.safeParse({
    date: formData.get("date"),
    memo: formData.get("memo"),
    debitAccountId: formData.get("debitAccountId"),
    creditAccountId: formData.get("creditAccountId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const amountCents = toCents(parsed.data.amount);
  if (amountCents <= 0) return { ok: false, error: { amount: ["Amount must be > 0"] } };

  const date = parsed.data.date ? new Date(String(parsed.data.date)) : new Date();
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: { date: ["Date must be valid"] } };
  }

  const accountIds = [...new Set([parsed.data.debitAccountId, parsed.data.creditAccountId])];
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      id: { in: accountIds },
      isGroup: false,
    },
    select: { id: true },
  });
  if (accounts.length !== accountIds.length) {
    return { ok: false, error: { accounts: ["Accounts must belong to the active company and be posting accounts."] } };
  }

  await prisma.journalEntry.create({
    data: {
      tenantId: company?.tenantId ?? null,
      companyId,
      date,
      memo: parsed.data.memo || null,
      totalDebitCents: amountCents,
      totalCreditCents: amountCents,
      lines: {
        create: [
          {
            lineNo: 1,
            accountId: parsed.data.debitAccountId,
            debitCents: amountCents,
            creditCents: 0,
          },
          {
            lineNo: 2,
            accountId: parsed.data.creditAccountId,
            debitCents: 0,
            creditCents: amountCents,
          },
        ],
      },
    },
  });

  revalidatePath("/accounting");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAccount(id: string) {
  const companyId = await getCompanyIdOrUserId();
  const account = await prisma.account.findFirst({
    where: { id, companyId },
    select: { id: true, isGroup: true },
  });

  if (!account) {
    return { ok: false, error: "Account not found." };
  }

  const [
    childCount,
    journalLineCount,
    glEntryCount,
    paymentEntryCount,
    supplierPaymentCount,
  ] = await Promise.all([
    prisma.account.count({
      where: { companyId, parentId: id },
    }),
    prisma.journalLine.count({
      where: { accountId: id, entry: { companyId } },
    }),
    prisma.gLEntry.count({
      where: { companyId, accountId: id },
    }),
    prisma.paymentEntry.count({
      where: {
        companyId,
        OR: [{ paidFromAccountId: id }, { paidToAccountId: id }],
      },
    }),
    prisma.supplierPayment.count({
      where: {
        companyId,
        OR: [{ paidFromAccountId: id }, { paidToAccountId: id }],
      },
    }),
  ]);

  if (childCount > 0) {
    return { ok: false, error: "Cannot delete a group account while it still has child accounts." };
  }

  if (account.isGroup) {
    return { ok: false, error: "Cannot delete a group account." };
  }

  if (journalLineCount + glEntryCount + paymentEntryCount + supplierPaymentCount > 0) {
    return { ok: false, error: "Cannot delete an account that is already referenced by transactions." };
  }

  await prisma.account.delete({ where: { id: account.id } });
  revalidatePath("/accounting");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteJournalEntry(id: string) {
  const companyId = await getCompanyIdOrUserId();
  const entry = await prisma.journalEntry.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!entry) {
    return { ok: false, error: "Journal entry not found." };
  }

  if (entry.status !== JournalEntryStatus.DRAFT) {
    return { ok: false, error: "Only draft journal entries can be deleted." };
  }

  const glEntryCount = await prisma.gLEntry.count({
    where: { companyId, journalEntryId: entry.id },
  });
  if (glEntryCount > 0) {
    return { ok: false, error: "Posted journal entries cannot be deleted." };
  }

  await prisma.journalEntry.delete({ where: { id: entry.id } });
  revalidatePath("/accounting");
  return { ok: true };
}
