import { prisma } from "@/lib/prisma";
import { requirePermission, requireStepUp } from "@/modules/iam";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { roleUpsertSchema } from "@/modules/iam/interface/schemas";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const principal = await requirePermission("admin.roles");
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant role access blocked");
    }

    const roles = await prisma.iamRole.findMany({
      where: { companyId: id },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        permissions: {
          include: {
            permission: {
              select: { id: true, key: true, module: true, description: true },
            },
          },
        },
      },
    });

    return ok(roles);
  } catch (error) {
    return err(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.roles");
    await requireStepUp();
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant role creation blocked");
    }
    const body = await parseBody(request, roleUpsertSchema);

    const created = await prisma.iamRole.create({
      data: {
        companyId: id,
        name: body.name,
        description: body.description ?? null,
        isSystem: false,
      },
      select: { id: true },
    });

    if (body.permissionKeys.length > 0) {
      const permissions = await prisma.iamPermission.findMany({
        where: { key: { in: body.permissionKeys } },
        select: { id: true },
      });

      await prisma.iamRolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: created.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }

    return ok({ id: created.id }, { status: 201 });
  } catch (error) {
    return err(error);
  }
}
