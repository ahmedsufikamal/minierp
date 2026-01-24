"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";

export async function initChartOfAccountsAction() {
  const orgId = await getOrgIdOrUserId();

  // Only seed if empty
  const existing = await prisma.account.count({ where: { orgId } });
  if (existing > 0) return;

  await prisma.account.createMany({
    data: [
      { orgId, code: "1000", name: "Cash", type: "ASSET" },
      { orgId, code: "1100", name: "Accounts Receivable", type: "ASSET" },
      { orgId, code: "1200", name: "Inventory", type: "ASSET" },
      { orgId, code: "2000", name: "Accounts Payable", type: "LIABILITY" },
      { orgId, code: "3000", name: "Owner's Equity", type: "EQUITY" },
      { orgId, code: "4000", name: "Sales", type: "INCOME" },
      { orgId, code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" },
      { orgId, code: "5100", name: "Operating Expenses", type: "EXPENSE" },
      { orgId, code: "5200", name: "Utilities Expense", type: "EXPENSE" },
    ],
  });
}
