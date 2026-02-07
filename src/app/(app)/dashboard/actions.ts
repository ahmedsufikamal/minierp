"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";

export async function initChartOfAccountsAction() {
  const companyId = await getCompanyIdOrUserId();

  // Only seed if empty
  const existing = await prisma.account.count({ where: { companyId } });
  if (existing > 0) return;

  await prisma.account.createMany({
    data: [
      { companyId, code: "1000", name: "Cash", type: "ASSET" },
      { companyId, code: "1100", name: "Accounts Receivable", type: "ASSET" },
      { companyId, code: "1200", name: "Inventory", type: "ASSET" },
      { companyId, code: "2000", name: "Accounts Payable", type: "LIABILITY" },
      { companyId, code: "3000", name: "Owner's Equity", type: "EQUITY" },
      { companyId, code: "4000", name: "Sales", type: "INCOME" },
      { companyId, code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" },
      { companyId, code: "5100", name: "Operating Expenses", type: "EXPENSE" },
      { companyId, code: "5200", name: "Utilities Expense", type: "EXPENSE" },
    ],
  });
}
