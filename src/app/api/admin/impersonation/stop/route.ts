import { getIdentityProvider, requireAuth, requireStepUp } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { z } from "zod";

const stopImpersonationSchema = z.object({
  sessionId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth({ allowMfaPending: false });
    await requireStepUp();
    const body = await parseBody(request, stopImpersonationSchema);
    const actorUserId = principal.impersonatorUserId ?? principal.userId;
    const sessionId = body.sessionId ?? principal.sessionId;

    await getIdentityProvider().stopImpersonation({
      actorUserId,
      sessionId,
    });

    return ok({ stopped: true });
  } catch (error) {
    return err(error);
  }
}
