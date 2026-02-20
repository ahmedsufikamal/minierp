import { CampaignStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  campaignActionSchema,
  campaignCreateSchema,
  campaignListQuerySchema,
} from "@/modules/crm/domain/schemas";

type CampaignAction = "ACTIVATE" | "COMPLETE" | "CANCEL";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: CampaignStatus, action: CampaignAction): CampaignStatus {
  const allowed: Record<CampaignAction, CampaignStatus[]> = {
    ACTIVATE: [CampaignStatus.DRAFT],
    COMPLETE: [CampaignStatus.ACTIVE],
    CANCEL: [CampaignStatus.DRAFT, CampaignStatus.ACTIVE],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} campaign from ${current}`);
  }

  return action === "ACTIVATE"
    ? CampaignStatus.ACTIVE
    : action === "COMPLETE"
      ? CampaignStatus.COMPLETED
      : CampaignStatus.CANCELLED;
}

export async function listCampaigns(ctx: PlatformRequestContext, input: unknown) {
  const parsed = campaignListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid campaign query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.CampaignWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        _count: {
          select: {
            leads: true,
            opportunities: true,
            activities: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.campaign.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createCampaign(ctx: PlatformRequestContext, input: unknown) {
  const parsed = campaignCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid campaign payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  if (payload.startsOn && payload.endsOn && payload.endsOn < payload.startsOn) {
    throw new PlatformError("VALIDATION_ERROR", "Campaign end date cannot be before start date");
  }

  try {
    return await prisma.campaign.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name: payload.name,
        status: CampaignStatus.DRAFT,
        startsOn: payload.startsOn,
        endsOn: payload.endsOn,
        budgetMinor: payload.budgetMinor,
        currency: payload.currency,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        _count: {
          select: {
            leads: true,
            opportunities: true,
            activities: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Campaign name already exists for this company");
    }
    throw error;
  }
}

export async function applyCampaignAction(ctx: PlatformRequestContext, campaignId: string, input: unknown) {
  const parsed = campaignActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid campaign action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      companyId: ctx.companyId,
    },
  });

  if (!campaign) {
    throw new PlatformError("NOT_FOUND", "Campaign not found");
  }

  const nextStatus = assertTransition(campaign.status, payload.action);

  return prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      status: nextStatus,
      updatedBy: ctx.userId,
    },
    include: {
      _count: {
        select: {
          leads: true,
          opportunities: true,
          activities: true,
        },
      },
    },
  });
}
