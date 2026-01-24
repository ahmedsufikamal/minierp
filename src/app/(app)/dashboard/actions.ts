"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "ASSET" as const },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" as const },
  { code: "1200", name: "Inventory", type: "ASSET" as const },

  { code: "2000", name: "Accounts Payable", type: "LIABILITY" as const },
  { code: "2100", name: "Taxes Payable", type: "LIABILITY" as const },

  { code: "3000", name: "Owner's Equity", type: "EQUITY" as const },

  { code: "4000", name: "Sales Revenue", type: "INCOME" as const },

  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" as const },
  { code: "5100", name: "Operating Expenses", type: "EXPENSE" as const },
];

export async function initChartOfAccounts() {
  const orgId = await getOrgIdOrUserId();

  const existing = await prisma.account.count({ where: { orgId } });
  if (existing > 0) return { ok: true, message: "Chart of accounts already exists." };

  await prisma.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({ ...a, orgId })),
  });

  revalidatePath("/accounting");
  revalidatePath("/dashboard");
  return { ok: true, message: "Chart of accounts initialized." };
}
