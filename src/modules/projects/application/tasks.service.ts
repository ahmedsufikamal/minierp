import { Prisma, ProjectTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { projectTaskActionSchema, projectTaskCreateSchema, projectTaskListQuerySchema } from "@/modules/projects/domain/schemas";

type ProjectTaskAction = "START" | "DONE" | "CANCEL" | "REOPEN";

function pageToSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

function assertTransition(current: ProjectTaskStatus, action: ProjectTaskAction): ProjectTaskStatus {
  const allowed: Record<ProjectTaskAction, ProjectTaskStatus[]> = {
    START: [ProjectTaskStatus.TODO],
    DONE: [ProjectTaskStatus.TODO, ProjectTaskStatus.IN_PROGRESS],
    CANCEL: [ProjectTaskStatus.TODO, ProjectTaskStatus.IN_PROGRESS],
    REOPEN: [ProjectTaskStatus.DONE, ProjectTaskStatus.CANCELLED],
  };

  if (!allowed[action].includes(current)) {
    throw new PlatformError("CONFLICT", `Cannot ${action.toLowerCase()} task from ${current}`);
  }

  switch (action) {
    case "START":
      return ProjectTaskStatus.IN_PROGRESS;
    case "DONE":
      return ProjectTaskStatus.DONE;
    case "CANCEL":
      return ProjectTaskStatus.CANCELLED;
    case "REOPEN":
      return ProjectTaskStatus.TODO;
  }
}

async function assertProject(companyId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
  if (!project) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid projectId for this company");
  }
}

export async function listProjectTasks(ctx: PlatformRequestContext, input: unknown) {
  const parsed = projectTaskListQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project task query", parsed.error.flatten());
  }

  const q = parsed.data;
  const where: Prisma.ProjectTaskWhereInput = {
    companyId: ctx.companyId,
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.assignedTo ? { assignedTo: q.assignedTo } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.projectTask.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true, status: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      skip: pageToSkip(q.page, q.limit),
      take: q.limit,
    }),
    prisma.projectTask.count({ where }),
  ]);

  return {
    page: q.page,
    limit: q.limit,
    total,
    rows,
  };
}

export async function createProjectTask(ctx: PlatformRequestContext, input: unknown) {
  const parsed = projectTaskCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project task payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  await assertProject(ctx.companyId, payload.projectId);

  return prisma.projectTask.create({
    data: {
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      projectId: payload.projectId,
      title: payload.title,
      description: payload.description,
      status: ProjectTaskStatus.TODO,
      priority: payload.priority,
      assignedTo: payload.assignedTo,
      dueDate: payload.dueDate,
      plannedMins: payload.plannedMins,
      billable: payload.billable ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      project: { select: { id: true, code: true, name: true, status: true } },
    },
  });
}

export async function applyProjectTaskAction(ctx: PlatformRequestContext, taskId: string, input: unknown) {
  const parsed = projectTaskActionSchema.safeParse(input);
  if (!parsed.success) {
    throw new PlatformError("VALIDATION_ERROR", "Invalid project task action payload", parsed.error.flatten());
  }

  const payload = parsed.data;

  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, companyId: ctx.companyId },
  });

  if (!task) {
    throw new PlatformError("NOT_FOUND", "Project task not found");
  }

  const nextStatus = assertTransition(task.status, payload.action);

  await prisma.projectTask.update({
    where: { id: task.id },
    data: {
      status: nextStatus,
      description: payload.note ? [task.description, payload.note].filter(Boolean).join("\n") : task.description,
      updatedBy: ctx.userId,
    },
  });

  return prisma.projectTask.findUniqueOrThrow({
    where: { id: task.id },
    include: {
      project: { select: { id: true, code: true, name: true, status: true } },
    },
  });
}
