import { prisma } from "@/lib/prisma";
import { requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { roleUpsertSchema } from "@/modules/iam/interface/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.roles");
    await requireStepUp();
    const { id, roleId } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant role update blocked");
    }
    const body = await parseBody(request, roleUpsertSchema);

    const existing = await prisma.iamRole.findUnique({
      where: { id: roleId },
      select: { companyId: true, isSystem: true, name: true },
    });
    if (!existing || existing.companyId !== id) {
      throw new IamError("FORBIDDEN", "Role does not belong to tenant");
    }
    if (existing.isSystem) {
      throw new IamError("VALIDATION_ERROR", "System roles cannot be edited");
    }

    await prisma.iamRole.update({
      where: { id: roleId },
      data: {
        name: body.name,
        description: body.description ?? null,
      },
      select: { id: true, companyId: true },
    });

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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.roles");
    await requireStepUp();
    const { id, roleId } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant role deletion blocked");
    }

    const role = await prisma.iamRole.findUnique({ where: { id: roleId }, select: { companyId: true, isSystem: true } });
    if (!role || role.companyId !== id) {
      throw new IamError("FORBIDDEN", "Role does not belong to tenant");
    }
    if (role.isSystem) {
      throw new IamError("VALIDATION_ERROR", "System roles cannot be deleted");
    }

    await prisma.iamRole.delete({ where: { id: roleId } });

    return ok({ deleted: true });
  } catch (error) {
    return err(error);
  }
}
