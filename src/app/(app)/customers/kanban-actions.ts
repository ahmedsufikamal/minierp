"use server";

import { prisma } from "@/lib/prisma";
import { getCompanyIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { OpportunityStage } from "@prisma/client";

export async function updateOpportunityStage(
  opportunityId: string,
  newStage: OpportunityStage,
  customerId: string,
) {
  const companyId = await getCompanyIdOrUserId();

  await prisma.opportunity.update({
    where: { id: opportunityId, companyId },
    data: { stage: newStage },
  });

  revalidatePath(`/customers/${customerId}`);
}
