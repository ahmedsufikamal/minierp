import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { roleUpsertSchema } from "@/modules/iam/interface/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  try {
    await requirePermission("admin.roles");
    const { id, roleId } = await params;
    const body = await parseBody(request, roleUpsertSchema);

    const role = await prisma.iamRole.update({
      where: { id: roleId },
      data: {
        name: body.name,
        description: body.description ?? null,
      },
      select: { id: true, companyId: true },
    });

    if (role.companyId !== id) {
      throw new Error("Role does not belong to tenant");
    }

    await prisma.iamRolePermission.deleteMany({ where: { roleId } });

    if (body.permissionKeys.length > 0) {
      const permissions = await prisma.iamPermission.findMany({
        where: { key: { in: body.permissionKeys } },
        select: { id: true },
      });

      await prisma.iamRolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }

    return ok({ updated: true });
  } catch (error) {
    return err(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  try {
    await requirePermission("admin.roles");
    const { id, roleId } = await params;

    const role = await prisma.iamRole.findUnique({ where: { id: roleId }, select: { companyId: true, isSystem: true } });
    if (!role || role.companyId !== id) {
      throw new Error("Role does not belong to tenant");
    }
    if (role.isSystem) {
      throw new Error("System roles cannot be deleted");
    }

    await prisma.iamRole.delete({ where: { id: roleId } });

    return ok({ deleted: true });
  } catch (error) {
    return err(error);
  }
}
