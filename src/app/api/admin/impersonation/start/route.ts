import { getIdentityProvider, requirePlatformAdmin, requireStepUp } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { impersonationStartSchema } from "@/modules/iam/interface/schemas";
import { getRequestContext } from "@/modules/iam/interface/request-context";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requirePlatformAdmin();
    await requireStepUp();
    const body = await parseBody(request, impersonationStartSchema);
    const ctx = getRequestContext(request);

    const result = await getIdentityProvider().startImpersonation({
      actorUserId: principal.userId,
      targetUserId: body.targetUserId,
      targetCompanyId: body.targetCompanyId,
      reason: body.reason,
      ttlMinutes: body.ttlMinutes,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return ok(result);
  } catch (error) {
    return err(error);
  }
}
