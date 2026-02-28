import { requireAuth } from "@/modules/iam";
import { err, ok } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { revokeCurrentUserSession } from "@/modules/iam/application/user-self.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const principal = await requireAuth();
    const { id } = await params;
    await revokeCurrentUserSession(principal, id);
    return ok({ revoked: true });
  } catch (error) {
    return err(error);
  }
}
