import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { z } from "zod";

const updateMemberSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("admin.members");
    const { id } = await params;

    const members = await prisma.companyMembership.findMany({
      where: { companyId: id },
      select: {
        userId: true,
        role: true,
        roleId: true,
        status: true,
        joinedAt: true,
        lastActiveAt: true,
        user: {
          select: {
            email: true,
            name: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(members);
  } catch (error) {
    return err(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("admin.members");
    const { id } = await params;
    const body = await parseBody(request, updateMemberSchema);

    const role = body.roleId ? await prisma.iamRole.findUnique({ where: { id: body.roleId }, select: { id: true, name: true } }) : null;

    const updated = await prisma.companyMembership.update({
      where: { userId_companyId: { userId: body.userId, companyId: id } },
      data: {
        roleId: body.roleId === undefined ? undefined : body.roleId,
        role: role?.name ?? undefined,
        status: body.status,
      },
      select: { userId: true, companyId: true, role: true, roleId: true, status: true },
    });

    return ok(updated);
  } catch (error) {
    return err(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("admin.members");
    const { id } = await params;
    const body = await parseBody(request, z.object({ userId: z.string().min(1) }));

    await prisma.companyMembership.delete({
      where: {
        userId_companyId: {
          userId: body.userId,
          companyId: id,
        },
      },
    });

    return ok({ removed: true });
  } catch (error) {
    return err(error);
  }
}
