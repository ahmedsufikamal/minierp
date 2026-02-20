import { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { projectActionSchema, projectCreateSchema, projectListQuerySchema } from "@/modules/projects/domain/schemas";

type ProjectAction = "START" | "HOLD" | "COMPLETE" | "CANCEL" | "REOPEN";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: ProjectStatus, action: ProjectAction): ProjectStatus {
  const allowed: Record<ProjectAction, ProjectStatus[]> = {
    START: [ProjectStatus.DRAFT],
    HOLD: [ProjectStatus.ACTIVE],
    COMPLETE: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD],
    CANCEL: [ProjectStatus.DRAFT, ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD],
    REOPEN: [ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED, ProjectStatus.CANCELLED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} project from ${current}`);
  }

  switch (action) {
    case "START":
      return ProjectStatus.ACTIVE;
    case "HOLD":
      return ProjectStatus.ON_HOLD;
    case "COMPLETE":
      return ProjectStatus.COMPLETED;
    case "CANCEL":
      return ProjectStatus.CANCELLED;
    case "REOPEN":
      return ProjectStatus.ACTIVE;
  }
}

async function assertCustomer(companyId: string, customerId: string | null | undefined): Promise<void> {
  if (!customerId) return;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  if (!customer) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid customerId for this company");
  }
}

export async function listProjects(ctx: PlatformRequestContext, input: unknown) {
  const parsed = projectListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.ProjectWhereInput = {
    companyId: ctx.companyId,
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.q
      ? {
          OR: [
            { code: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
            { notes: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        _count: {
          select: {
            tasks: true,
            timesheets: true,
            tickets: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.project.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createProject(ctx: PlatformRequestContext, input: unknown) {
  const parsed = projectCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertCustomer(ctx.companyId, payload.customerId);

  try {
    return await prisma.project.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        code: payload.code,
        name: payload.name,
        status: ProjectStatus.DRAFT,
        customerId: payload.customerId,
        startDate: payload.startDate,
        endDate: payload.endDate,
        notes: payload.notes,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
      include: {
        customer: { select: { id: true, name: true } },
        _count: {
          select: {
            tasks: true,
            timesheets: true,
            tickets: true,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new PlatformError("CONFLICT", "Project code already exists for this company");
    }
    throw error;
  }
}

export async function applyProjectAction(ctx: PlatformRequestContext, projectId: string, input: unknown) {
  const parsed = projectActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
  });

  if (!project) {
    throw new PlatformError("NOT_FOUND", "Project not found");
  }

  const nextStatus = assertTransition(project.status, payload.action);

  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: nextStatus,
      notes: payload.note ? [project.notes, payload.note].filter(Boolean).join("\n") : project.notes,
      updatedBy: ctx.userId,
    },
  });

  return prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: {
      customer: { select: { id: true, name: true } },
      _count: {
        select: {
          tasks: true,
          timesheets: true,
          tickets: true,
        },
      },
    },
  });
}
