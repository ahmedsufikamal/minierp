import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { timelineQuerySchema } from "@/modules/crm/domain/schemas";

type TimelineEventType = "ACTIVITY" | "OPPORTUNITY_STAGE" | "LEAD_STATUS";

type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  occurredAt: Date;
  title: string;
  description: string | null;
  customerId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  campaignId: string | null;
  actorId: string | null;
};

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function getCrmTimeline(ctx: PlatformRequestContext, input: unknown) {
  const parsed = timelineQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid CRM timeline query", parsed.error.flatten());
  }

  const q = parsed.data;

  const activityWhere = {
    companyId: ctx.companyId,
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.leadId ? { leadId: q.leadId } : {}),
    ...(q.opportunityId ? { opportunityId: q.opportunityId } : {}),
    ...(q.campaignId ? { campaignId: q.campaignId } : {}),
  };

  const opportunityHistoryWhere = {
    companyId: ctx.companyId,
    ...(q.opportunityId ? { opportunityId: q.opportunityId } : {}),
    ...(q.customerId || q.leadId || q.campaignId
      ? {
          opportunity: {
            ...(q.customerId ? { customerId: q.customerId } : {}),
            ...(q.leadId ? { leadId: q.leadId } : {}),
            ...(q.campaignId ? { campaignId: q.campaignId } : {}),
          },
        }
      : {}),
  };

  const leadWhere = {
    companyId: ctx.companyId,
    ...(q.leadId ? { id: q.leadId } : {}),
    ...(q.campaignId ? { campaignId: q.campaignId } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
  };

  const [activities, histories, leads] = await Promise.all([
    prisma.activity.findMany({
      where: activityWhere,
      orderBy: [{ date: "desc" }],
      take: 300,
      select: {
        id: true,
        type: true,
        subject: true,
        description: true,
        date: true,
        customerId: true,
        leadId: true,
        opportunityId: true,
        campaignId: true,
      },
    }),
    prisma.opportunityStageHistory.findMany({
      where: opportunityHistoryWhere,
      orderBy: [{ changedAt: "desc" }],
      take: 300,
      select: {
        id: true,
        action: true,
        note: true,
        fromStage: true,
        toStage: true,
        changedAt: true,
        changedBy: true,
        opportunity: {
          select: {
            id: true,
            title: true,
            customerId: true,
            leadId: true,
            campaignId: true,
          },
        },
      },
    }),
    prisma.lead.findMany({
      where: leadWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 150,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        notes: true,
        createdAt: true,
        qualifiedAt: true,
        convertedAt: true,
        updatedAt: true,
        customerId: true,
        campaignId: true,
        createdBy: true,
        updatedBy: true,
      },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const activity of activities) {
    events.push({
      id: `activity:${activity.id}`,
      type: "ACTIVITY",
      occurredAt: activity.date,
      title: `${activity.type}: ${activity.subject}`,
      description: activity.description,
      customerId: activity.customerId,
      leadId: activity.leadId,
      opportunityId: activity.opportunityId,
      campaignId: activity.campaignId,
      actorId: null,
    });
  }

  for (const history of histories) {
    events.push({
      id: `stage:${history.id}`,
      type: "OPPORTUNITY_STAGE",
      occurredAt: history.changedAt,
      title: `${history.opportunity.title} -> ${history.toStage}`,
      description: history.note ?? (history.fromStage ? `${history.fromStage} -> ${history.toStage}` : history.action),
      customerId: history.opportunity.customerId,
      leadId: history.opportunity.leadId,
      opportunityId: history.opportunity.id,
      campaignId: history.opportunity.campaignId,
      actorId: history.changedBy,
    });
  }

  for (const lead of leads) {
    const leadLabel = `${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`;

    events.push({
      id: `lead:created:${lead.id}`,
      type: "LEAD_STATUS",
      occurredAt: lead.createdAt,
      title: `${leadLabel} created`,
      description: lead.notes,
      customerId: lead.customerId,
      leadId: lead.id,
      opportunityId: null,
      campaignId: lead.campaignId,
      actorId: lead.createdBy,
    });

    if (lead.qualifiedAt) {
      events.push({
        id: `lead:qualified:${lead.id}`,
        type: "LEAD_STATUS",
        occurredAt: lead.qualifiedAt,
        title: `${leadLabel} qualified`,
        description: null,
        customerId: lead.customerId,
        leadId: lead.id,
        opportunityId: null,
        campaignId: lead.campaignId,
        actorId: lead.updatedBy,
      });
    }

    if (lead.convertedAt) {
      events.push({
        id: `lead:converted:${lead.id}`,
        type: "LEAD_STATUS",
        occurredAt: lead.convertedAt,
        title: `${leadLabel} converted`,
        description: null,
        customerId: lead.customerId,
        leadId: lead.id,
        opportunityId: null,
        campaignId: lead.campaignId,
        actorId: lead.updatedBy,
      });
    }

    if (lead.status === "LOST") {
      events.push({
        id: `lead:lost:${lead.id}`,
        type: "LEAD_STATUS",
        occurredAt: lead.updatedAt,
        title: `${leadLabel} lost`,
        description: lead.notes,
        customerId: lead.customerId,
        leadId: lead.id,
        opportunityId: null,
        campaignId: lead.campaignId,
        actorId: lead.updatedBy,
      });
    }
  }

  const sorted = events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const total = sorted.length;
  const rows = sorted.slice(pageToSkip(q.page, q.limit), pageToSkip(q.page, q.limit) + q.limit);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}
