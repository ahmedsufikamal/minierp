import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { ok, err } from "@/modules/iam/interface/http";

export async function POST() {
  try {
    const principal = await requireAuth();
    await getIdentityProvider().revokeAllSessionsForUser(principal.userId, principal.userId);
    return ok({ revoked: true });
  } catch (error) {
    return err(error);
  }
}
