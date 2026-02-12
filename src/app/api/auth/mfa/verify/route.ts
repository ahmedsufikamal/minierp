import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { mfaVerifySchema } from "@/modules/iam/interface/schemas";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, mfaVerifySchema);
    const principal = await requireAuth();

    await getIdentityProvider().verifyMfa({
      userId: principal.userId,
      code: body.code,
    });

    return ok({ verified: true });
  } catch (error) {
    return err(error);
  }
}
