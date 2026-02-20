import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  emailTemplateCreateSchema,
  emailTemplateListQuerySchema,
} from "@/modules/integrations/domain/schemas";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export async function listEmailTemplates(ctx: PlatformRequestContext, input: unknown) {
  const parsed = emailTemplateListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid email template query",
      parsed.error.flatten(),
    );
  }

  const q = parsed.data;
  const where: Prisma.IntegrationEmailTemplateWhereInput = {
    companyId: ctx.companyId,
    ...(typeof q.isActive === "boolean" ? { isActive: q.isActive } : {}),
    ...(q.q
      ? {
          OR: [
            { key: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
            { subject: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.integrationEmailTemplate.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.integrationEmailTemplate.count({ where }),
  ]);

  return { page: q.page, limit: q.limit, total, rows };
}

export async function createEmailTemplate(ctx: PlatformRequestContext, input: unknown) {
  const parsed = emailTemplateCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError(
      "VALIDATION_ERROR",
      "Invalid email template payload",
      parsed.error.flatten(),
    );
  }

  const payload = parsed.data;

  try {
    return await prisma.integrationEmailTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        key: payload.key,
        name: payload.name,
        subject: payload.subject,
        body: payload.body,
        isActive: payload.isActive ?? true,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Email template key already exists for this company");
    }
    throw error;
  }
}
