"use server";

import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { OpportunityStage } from "@prisma/client";

export async function updateOpportunityStage(opportunityId: string, newStage: OpportunityStage, customerId: string) {
    const orgId = await getOrgIdOrUserId();

    await prisma.opportunity.update({
        where: { id: opportunityId, orgId },
        data: { stage: newStage },
    });

    revalidatePath(`/customers/${customerId}`);
}
