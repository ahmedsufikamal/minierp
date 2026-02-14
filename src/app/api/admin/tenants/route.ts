import { requirePlatformAdmin, requireStepUp } from "@/modules/iam";
import { createTenantWithMasterAdminInvite } from "@/modules/iam/application/platform-admin";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { adminTenantCreateSchema } from "@/modules/iam/interface/schemas";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const body = await parseBody(request, adminTenantCreateSchema);

    const result = await createTenantWithMasterAdminInvite({
      actorUserId: principal.userId,
      name: body.name,
      slug: body.slug,
      masterAdminEmail: body.masterAdminEmail,
    });

    return ok(result, { status: 201 });
  } catch (error) {
    return err(error);
  }
}
