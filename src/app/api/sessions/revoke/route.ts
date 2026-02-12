import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { sessionRevokeSchema } from "@/modules/iam/interface/schemas";

export async function POST(request: Request) {
  try {
    const principal = await requireAuth();
    const body = await parseBody(request, sessionRevokeSchema);

    await getIdentityProvider().revokeSession(body.sessionId, principal.userId);
    return ok({ revoked: true });
  } catch (error) {
    return err(error);
  }
}
