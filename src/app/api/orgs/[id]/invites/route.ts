import { getIdentityProvider, requirePermission, requireTenantMembership } from "@/modules/iam";
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
