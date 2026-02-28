import { requirePlatformAdmin } from "@/modules/iam";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { err, ok } from "@/modules/iam/interface/http";
import { revokeAdminUserSession } from "@/modules/iam/application/user-admin.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    const { id, sessionId } = await params;
    const data = await revokeAdminUserSession({ actor: principal, targetUserId: id, sessionId });
    return ok(data);
  } catch (error) {
    return err(error);
  }
}
