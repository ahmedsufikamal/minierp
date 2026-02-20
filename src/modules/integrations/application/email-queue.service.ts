import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  emailQueueCreateSchema,
  emailQueueListQuerySchema,
} from "@/modules/integrations/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

async function assertTemplate(
  companyId: string,
  templateId: string | null | undefined,
): Promise<void> {
  if (!templateId) return;

  const template = await prisma.integrationEmailTemplate.findFirst({
    where: { id: templateId, companyId },
    select: { id: true, isActive: true },
  });

  if (!template) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid templateId for this company");
  }

  if (!template.isActive) {
    throw new PlatformError("CONFLICT", "Cannot queue email using an inactive template");
  }
}

export async function listEmailQueue(ctx: PlatformRequestContext, input: unknown) {
  const parsed = emailQueueListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid email queue query",
      parsed.error.flatten(),
    );
  }

  const q = parsed.data;
  const where: Prisma.IntegrationEmailQueueWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.toEmail ? { toEmail: { contains: q.toEmail, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.integrationEmailQueue.findMany({
      where,
      include: {
        template: { select: { id: true, key: true, name: true, isActive: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.integrationEmailQueue.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function enqueueEmail(ctx: PlatformRequestContext, input: unknown) {
  const parsed = emailQueueCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid email queue payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  await assertTemplate(ctx.companyId, payload.templateId);

  return prisma.integrationEmailQueue.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      templateId: payload.templateId,
      toEmail: payload.toEmail,
      subject: payload.subject,
      body: payload.body,
      status: "QUEUED",
      scheduledAt: payload.scheduledAt,
    },
    include: {
      template: { select: { id: true, key: true, name: true, isActive: true } },
    },
  });
}
