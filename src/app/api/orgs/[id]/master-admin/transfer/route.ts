import { requirePermission, requireStepUp } from "@/modules/iam";
import { transferMasterAdmin } from "@/modules/iam/application/master-admin";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { masterAdminTransferSchema } from "@/modules/iam/interface/schemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePermission("admin.members");
    await requireStepUp();
    const { id } = await params;
    if (principal.activeCompanyId !== id) {
      throw new IamError("FORBIDDEN", "Cross-tenant master-admin transfer blocked");
    }
    const body = await parseBody(request, masterAdminTransferSchema);

    const result = await transferMasterAdmin({
      companyId: id,
      actorUserId: principal.userId,
      nextOwnerUserId: body.targetUserId,
    });

    return ok(result);
  } catch (error) {
    return err(error);
  }
}
