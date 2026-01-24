"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  const orgId = await getOrgIdOrUserId();

  const parsed = AccountSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  await prisma.account.create({
    data: { orgId, ...parsed.data },
  });

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
  const orgId = await getOrgIdOrUserId();

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

  await prisma.journalEntry.create({
    data: {
      orgId,
      date,
      memo: parsed.data.memo || null,
      lines: {
        create: [
          {
            accountId: parsed.data.debitAccountId,
            debitCents: amountCents,
            creditCents: 0,
          },
          {
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
  const orgId = await getOrgIdOrUserId();
  await prisma.account.deleteMany({ where: { id, orgId } });
  revalidatePath("/accounting");
  return { ok: true };
}

export async function deleteJournalEntry(id: string) {
  const orgId = await getOrgIdOrUserId();
  await prisma.journalEntry.deleteMany({ where: { id, orgId } });
  revalidatePath("/accounting");
  return { ok: true };
}
