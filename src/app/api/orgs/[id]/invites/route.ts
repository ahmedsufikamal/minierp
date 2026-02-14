import { prisma } from "@/lib/prisma";
import { getIdentityProvider, requirePermission, requireTenantMembership } from "@/modules/iam";
import { MASTER_ADMIN_ROLE_NAME } from "@/modules/iam/application/master-admin";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { invitePayloadSchema } from "@/modules/iam/interface/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requirePermission("admin.members");
    const principal = await requireTenantMembership();
    const { id } = await params;
    const body = await parseBody(request, invitePayloadSchema);

    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant invite blocked");
    }

    if (body.roleId) {
      const role = await prisma.iamRole.findUnique({
        where: { id: body.roleId },
        select: { companyId: true, name: true },
      });
      if (!role || role.companyId !== id) {
        throw new IamError("VALIDATION_ERROR", "Invalid role for tenant");
      }
      if (role.name === MASTER_ADMIN_ROLE_NAME) {
        throw new IamError("VALIDATION_ERROR", "Master Admin invitations are not allowed from tenant invite flows");
      }
    }

    const invited = await getIdentityProvider().inviteToOrg({
      companyId: id,
      email: body.email,
      roleId: body.roleId,
      createdByUserId: principal.userId,
      autoJoinRuleId: body.autoJoinRuleId,
    });

    return ok(invited, { status: 201 });
  } catch (error) {
    return err(error);
  }
}
