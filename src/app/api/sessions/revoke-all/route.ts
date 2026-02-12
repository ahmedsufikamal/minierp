import { getIdentityProvider, requireAuth, requireStepUp } from "@/modules/iam";
import { ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();
    await requireStepUp();
    await getIdentityProvider().revokeAllSessionsForUser(principal.userId, principal.userId);
    return ok({ revoked: true });
  } catch (error) {
    return err(error);
  }
}
