import { requireAuth } from "@/modules/iam";
import { err, ok } from "@/modules/iam/interface/http";
import { listCurrentUserSessions } from "@/modules/iam/application/user-self.service";

export async function GET() {
  try {
    const principal = await requireAuth();
    const sessions = await listCurrentUserSessions(principal);
    return ok(sessions);
  } catch (error) {
    return err(error);
  }
}
