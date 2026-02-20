import { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { leadActionSchema, leadCreateSchema, leadListQuerySchema } from "@/modules/crm/domain/schemas";

type LeadAction = "QUALIFY" | "LOSE" | "CONVERT";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: LeadStatus, action: LeadAction): LeadStatus {
  const allowed: Record<LeadAction, LeadStatus[]> = {
    QUALIFY: [LeadStatus.OPEN],
    LOSE: [LeadStatus.OPEN, LeadStatus.QUALIFIED],
    CONVERT: [LeadStatus.QUALIFIED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} lead from ${current}`);
  }

  return action === "QUALIFY"
    ? LeadStatus.QUALIFIED
    : action === "LOSE"
      ? LeadStatus.LOST
      : LeadStatus.CONVERTED;
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

async function assertCustomer(companyId: string, customerId: string): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

export async function listLeads(ctx: PlatformRequestContext, input: unknown) {
  const parsed = leadListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid lead query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.LeadWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.campaignId ? { campaignId: q.campaignId } : {}),
    ...(q.q
      ? {
          OR: [
            { firstName: { contains: q.q, mode: "insensitive" } },
            { lastName: { contains: q.q, mode: "insensitive" } },
            { email: { contains: q.q, mode: "insensitive" } },
            { phone: { contains: q.q, mode: "insensitive" } },
            { source: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        campaign: { select: { id: true, name: true, status: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createLead(ctx: PlatformRequestContext, input: unknown) {
  const parsed = leadCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid lead payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  await assertCampaign(ctx.companyId, payload.campaignId);

  return prisma.lead.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      campaignId: payload.campaignId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      source: payload.source,
      status: LeadStatus.OPEN,
      notes: payload.notes,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      campaign: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true } },
    },
  });
}

export async function applyLeadAction(ctx: PlatformRequestContext, leadId: string, input: unknown) {
  const parsed = leadActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid lead action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId: ctx.companyId },
    include: {
      campaign: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true } },
    },
  });

  if (!lead) {
    throw new PlatformError("NOT_FOUND", "Lead not found");
  }

  const nextStatus = assertTransition(lead.status, payload.action);

  if (payload.action === "CONVERT" && !payload.customerId) {
    throw new PlatformError("VALIDATION_ERROR", "customerId is required for CONVERT action");
  }

  if (payload.customerId) {
    await assertCustomer(ctx.companyId, payload.customerId);
  }

  const now = new Date();

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: nextStatus,
      qualifiedAt: payload.action === "QUALIFY" ? now : lead.qualifiedAt,
      convertedAt: payload.action === "CONVERT" ? now : lead.convertedAt,
      customerId: payload.action === "CONVERT" ? payload.customerId : lead.customerId,
      notes: payload.reason ? [lead.notes, payload.reason].filter(Boolean).join("\n") : lead.notes,
      updatedBy: ctx.userId,
    },
    include: {
      campaign: { select: { id: true, name: true, status: true } },
      customer: { select: { id: true, name: true } },
    },
  });

  if (payload.action === "CONVERT") {
    await prisma.outboxEvent.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        topic: "crm.lead.converted",
        aggregateType: "Lead",
        aggregateId: lead.id,
        payload: {
          leadId: lead.id,
          customerId: payload.customerId,
          convertedBy: ctx.userId,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return updated;
}
