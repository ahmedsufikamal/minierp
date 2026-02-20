import { KnowledgeArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import {
  knowledgeArticleActionSchema,
  knowledgeArticleCreateSchema,
  knowledgeArticleListQuerySchema,
} from "@/modules/support/domain/schemas";

type KnowledgeAction = "SUBMIT_REVIEW" | "PUBLISH" | "ARCHIVE" | "REOPEN" | "ADD_REVISION";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: KnowledgeArticleStatus, action: KnowledgeAction): KnowledgeArticleStatus {
  if (action === "ADD_REVISION") return current;

  const allowed: Record<Exclude<KnowledgeAction, "ADD_REVISION">, KnowledgeArticleStatus[]> = {
    SUBMIT_REVIEW: [KnowledgeArticleStatus.DRAFT],
    PUBLISH: [KnowledgeArticleStatus.DRAFT, KnowledgeArticleStatus.REVIEW],
    ARCHIVE: [KnowledgeArticleStatus.DRAFT, KnowledgeArticleStatus.REVIEW, KnowledgeArticleStatus.PUBLISHED],
    REOPEN: [KnowledgeArticleStatus.ARCHIVED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} article from ${current}`);
  }

  switch (action) {
    case "SUBMIT_REVIEW":
      return KnowledgeArticleStatus.REVIEW;
    case "PUBLISH":
      return KnowledgeArticleStatus.PUBLISHED;
    case "ARCHIVE":
      return KnowledgeArticleStatus.ARCHIVED;
    case "REOPEN":
      return KnowledgeArticleStatus.DRAFT;
    default:
      return current;
  }
}

export async function listKnowledgeArticles(ctx: PlatformRequestContext, input: unknown) {
  const parsed = knowledgeArticleListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid knowledge base query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.KnowledgeArticleWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.q
      ? {
          OR: [
            { slug: { contains: q.q, mode: "insensitive" } },
            { title: { contains: q.q, mode: "insensitive" } },
            { summary: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where,
      include: {
        revisions: {
          orderBy: [{ revisionNo: "desc" }],
          take: 1,
        },
        _count: {
          select: {
            revisions: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.knowledgeArticle.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createKnowledgeArticle(ctx: PlatformRequestContext, input: unknown) {
  const parsed = knowledgeArticleCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid knowledge article payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const article = await tx.knowledgeArticle.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          slug: payload.slug,
          title: payload.title,
          summary: payload.summary ?? null,
          status: KnowledgeArticleStatus.DRAFT,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });

      const revision = await tx.knowledgeArticleRevision.create({
        data: {
          articleId: article.id,
          revisionNo: 1,
          title: payload.title,
          content: payload.content,
          changelog: payload.changelog ?? null,
          createdBy: ctx.userId,
        },
      });

      await tx.knowledgeArticle.update({
        where: { id: article.id },
        data: {
          currentRevisionId: revision.id,
          updatedBy: ctx.userId,
        },
      });

      return tx.knowledgeArticle.findUniqueOrThrow({
        where: { id: article.id },
        include: {
          revisions: {
            orderBy: [{ revisionNo: "desc" }],
            take: 1,
          },
          _count: {
            select: {
              revisions: true,
            },
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Knowledge article slug already exists for this company");
    }
    throw error;
  }
}

export async function applyKnowledgeArticleAction(
  ctx: PlatformRequestContext,
  articleId: string,
  input: unknown,
) {
  const parsed = knowledgeArticleActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid knowledge article action", parsed.error.flatten());
  }

  const payload = parsed.data;

  const article = await prisma.knowledgeArticle.findFirst({
    where: { id: articleId, companyId: ctx.companyId },
    include: {
      revisions: {
        orderBy: [{ revisionNo: "desc" }],
        take: 1,
      },
    },
  });

  if (!article) {
    throw new PlatformError("NOT_FOUND", "Knowledge article not found");
  }

  if (payload.action === "ADD_REVISION") {
    const revisionTitle = payload.title;
    const revisionContent = payload.content;
    if (!revisionTitle || !revisionContent) {
      throw new PlatformError("VALIDATION_ERROR", "ADD_REVISION requires both title and content");
    }

    return prisma.$transaction(async (tx) => {
      const latest = await tx.knowledgeArticleRevision.findFirst({
        where: { articleId: article.id },
        orderBy: [{ revisionNo: "desc" }],
        select: { revisionNo: true },
      });

      const nextRevisionNo = (latest?.revisionNo ?? 0) + 1;
      const revision = await tx.knowledgeArticleRevision.create({
        data: {
          articleId: article.id,
          revisionNo: nextRevisionNo,
          title: revisionTitle,
          content: revisionContent,
          changelog: payload.changelog ?? payload.note ?? null,
          createdBy: ctx.userId,
        },
      });

      await tx.knowledgeArticle.update({
        where: { id: article.id },
        data: {
          title: revisionTitle,
          summary: payload.summary ?? article.summary,
          currentRevisionId: revision.id,
          updatedBy: ctx.userId,
        },
      });

      return tx.knowledgeArticle.findUniqueOrThrow({
        where: { id: article.id },
        include: {
          revisions: {
            orderBy: [{ revisionNo: "desc" }],
            take: 5,
          },
          _count: {
            select: {
              revisions: true,
            },
          },
        },
      });
    });
  }

  const nextStatus = assertTransition(article.status, payload.action);
  const now = new Date();

  return prisma.knowledgeArticle.update({
    where: { id: article.id },
    data: {
      status: nextStatus,
      title: payload.title ?? article.title,
      summary: payload.summary ?? article.summary,
      publishedAt:
        payload.action === "PUBLISH"
          ? now
          : payload.action === "REOPEN"
            ? null
            : article.publishedAt,
      archivedAt:
        payload.action === "ARCHIVE"
          ? now
          : payload.action === "REOPEN"
            ? null
            : article.archivedAt,
      updatedBy: ctx.userId,
    },
    include: {
      revisions: {
        orderBy: [{ revisionNo: "desc" }],
        take: 5,
      },
      _count: {
        select: {
          revisions: true,
        },
      },
    },
  });
}
