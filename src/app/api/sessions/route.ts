import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { ok, err } from "@/modules/iam/interface/http";

export async function GET() {
  try {
    const principal = await requireAuth();
    const sessions = await getIdentityProvider().listUserSessions(principal.userId);
    return ok(sessions);
  } catch (error) {
    return err(error);
  }
}
