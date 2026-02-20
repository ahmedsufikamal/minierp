import { OpportunityStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  opportunityActionSchema,
  opportunityCreateSchema,
  opportunityListQuerySchema,
} from "@/modules/crm/domain/schemas";

type OpportunityAction = "QUALIFY" | "PROPOSE" | "NEGOTIATE" | "WIN" | "LOSE" | "REOPEN";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function nextStage(current: OpportunityStage, action: OpportunityAction): OpportunityStage {
  const transitions: Record<OpportunityAction, OpportunityStage[]> = {
    QUALIFY: [OpportunityStage.NEW],
    PROPOSE: [OpportunityStage.QUALIFICATION],
    NEGOTIATE: [OpportunityStage.PROPOSAL],
    WIN: [OpportunityStage.QUALIFICATION, OpportunityStage.PROPOSAL, OpportunityStage.NEGOTIATION],
    LOSE: [OpportunityStage.NEW, OpportunityStage.QUALIFICATION, OpportunityStage.PROPOSAL, OpportunityStage.NEGOTIATION],
    REOPEN: [OpportunityStage.WON, OpportunityStage.LOST],
  };

  if (!transitions[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} opportunity from ${current}`);
  }

  switch (action) {
    case "QUALIFY":
      return OpportunityStage.QUALIFICATION;
    case "PROPOSE":
      return OpportunityStage.PROPOSAL;
    case "NEGOTIATE":
      return OpportunityStage.NEGOTIATION;
    case "WIN":
      return OpportunityStage.WON;
    case "LOSE":
      return OpportunityStage.LOST;
    case "REOPEN":
      return OpportunityStage.QUALIFICATION;
  }
}

function probabilityForStage(stage: OpportunityStage): number {
  switch (stage) {
    case OpportunityStage.NEW:
      return 10;
    case OpportunityStage.QUALIFICATION:
      return 30;
    case OpportunityStage.PROPOSAL:
      return 60;
    case OpportunityStage.NEGOTIATION:
      return 80;
    case OpportunityStage.WON:
      return 100;
    case OpportunityStage.LOST:
      return 0;
  }
}

async function assertCustomer(companyId: string, customerId: string): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

async function assertLead(companyId: string, leadId: string | null | undefined): Promise<void> {
  if (!leadId) return;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId },
    select: { id: true },
  });
  if (!lead) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid leadId for this company");
  }
}

async function assertCampaign(companyId: string, campaignId: string | null | undefined): Promise<void> {
  if (!campaignId) return;
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, companyId },
    select: { id: true },
  });
  if (!campaign) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid campaignId for this company");
  }
}

export async function listOpportunities(ctx: PlatformRequestContext, input: unknown) {
  const parsed = opportunityListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid opportunity query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.OpportunityWhereInput = {
    companyId: ctx.companyId,
    ...(q.stage ? { stage: q.stage } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.leadId ? { leadId: q.leadId } : {}),
    ...(q.campaignId ? { campaignId: q.campaignId } : {}),
    ...(q.q
      ? {
          OR: [
            { title: { contains: q.q, mode: "insensitive" } },
            { description: { contains: q.q, mode: "insensitive" } },
            { customer: { name: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true, status: true } },
        campaign: { select: { id: true, name: true, status: true } },
        stageHistories: {
          orderBy: [{ changedAt: "desc" }],
          take: 10,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createOpportunity(ctx: PlatformRequestContext, input: unknown) {
  const parsed = opportunityCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid opportunity payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await Promise.all([
    assertCustomer(ctx.companyId, payload.customerId),
    assertLead(ctx.companyId, payload.leadId),
    assertCampaign(ctx.companyId, payload.campaignId),
  ]);

  return prisma.$transaction(async (tx) => {
    const opportunity = await tx.opportunity.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        title: payload.title,
        valueCents: payload.valueCents,
        stage: OpportunityStage.NEW,
        customerId: payload.customerId,
        leadId: payload.leadId,
        campaignId: payload.campaignId,
        probabilityPct: payload.probabilityPct ?? probabilityForStage(OpportunityStage.NEW),
        closeDate: payload.closeDate,
        description: payload.description,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });

    await tx.opportunityStageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        opportunityId: opportunity.id,
        fromStage: null,
        toStage: OpportunityStage.NEW,
        action: "CREATE",
        changedBy: ctx.userId,
      },
    });

    return tx.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
      include: {
        customer: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true, status: true } },
        campaign: { select: { id: true, name: true, status: true } },
        stageHistories: { orderBy: [{ changedAt: "desc" }] },
      },
    });
  });
}

export async function applyOpportunityAction(ctx: PlatformRequestContext, opportunityId: string, input: unknown) {
  const parsed = opportunityActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid opportunity action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, companyId: ctx.companyId },
  });

  if (!opportunity) {
    throw new PlatformError("NOT_FOUND", "Opportunity not found");
  }

  const next = nextStage(opportunity.stage, payload.action);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id: opportunity.id },
      data: {
        stage: next,
        closeDate: next === OpportunityStage.WON || next === OpportunityStage.LOST ? new Date() : opportunity.closeDate,
        probabilityPct: probabilityForStage(next),
        updatedBy: ctx.userId,
      },
    });

    await tx.opportunityStageHistory.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        opportunityId: opportunity.id,
        fromStage: opportunity.stage,
        toStage: next,
        action: payload.action,
        note: payload.note,
        changedBy: ctx.userId,
      },
    });

    if (payload.action === "WIN" || payload.action === "LOSE") {
      await tx.outboxEvent.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          topic: `crm.opportunity.${payload.action.toLowerCase()}`,
          aggregateType: "Opportunity",
          aggregateId: opportunity.id,
          payload: {
            opportunityId: opportunity.id,
            stage: next,
            action: payload.action,
            changedBy: ctx.userId,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return tx.opportunity.findUniqueOrThrow({
      where: { id: opportunity.id },
      include: {
        customer: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true, status: true } },
        campaign: { select: { id: true, name: true, status: true } },
        stageHistories: {
          orderBy: [{ changedAt: "desc" }],
          take: 20,
        },
      },
    });
  });

  return updated;
}
