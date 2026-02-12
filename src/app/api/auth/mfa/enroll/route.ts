import { getIdentityProvider, requireAuth } from "@/modules/iam";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { mfaEnrollSchema } from "@/modules/iam/interface/schemas";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, mfaEnrollSchema);
    const principal = await requireAuth();

    const data = await getIdentityProvider().enrollMfa({
      userId: principal.userId,
      label: body.label,
    });

    return ok(data);
  } catch (error) {
    return err(error);
  }
}
