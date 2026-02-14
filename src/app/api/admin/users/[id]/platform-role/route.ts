import { requirePlatformAdmin, requireStepUp } from "@/modules/iam";
import { updateUserPlatformRole } from "@/modules/iam/application/platform-admin";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { platformRoleUpdateSchema } from "@/modules/iam/interface/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const body = await parseBody(request, platformRoleUpdateSchema);
    const { id } = await params;

    const updated = await updateUserPlatformRole({
      actorUserId: principal.userId,
      targetUserId: id,
      nextRole: body.platformRole,
    });

    return ok(updated);
  } catch (error) {
    return err(error);
  }
}
