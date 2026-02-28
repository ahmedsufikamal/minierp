"use server";

import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { syncDefaultChartOfAccounts } from "@/modules/accounting/application/accounts.service";

export async function initChartOfAccountsAction() {
  const session = await getUser();
  if (!session?.userId) {
    return;
  }

  const companyId = session.companyId || session.userId;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantId: true },
  });

  await syncDefaultChartOfAccounts({
    requestId: `coa-init-${companyId}`,
    tenantId: company?.tenantId ?? companyId,
    companyId,
    userId: session.userId,
    role: "role" in session ? (session.role ?? "") : "",
    platformRole: "NONE",
    permissions: "permissions" in session && Array.isArray(session.permissions) ? session.permissions : [],
  });

  revalidatePath("/dashboard");
  revalidatePath("/accounting");
  revalidatePath("/accounting/coa");
}
