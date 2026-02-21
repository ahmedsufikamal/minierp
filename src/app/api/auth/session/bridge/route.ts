import { syncLegacyFromIamSession } from "@/lib/session";
import { IamError } from "@/modules/iam/domain/errors";
import { resolvePrincipalFromCookies } from "@/modules/iam/application/principal-resolver";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { err, ok } from "@/modules/iam/interface/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const resolved = await resolvePrincipalFromCookies({ allowLegacyFallback: false });
    if (!resolved.principal) {
      throw new IamError("UNAUTHORIZED", "Authentication required");
    }

    if (resolved.source === "iam") {
      await syncLegacyFromIamSession();
      return ok({ bridged: false, reason: "already_iam" });
    }

    throw new IamError("FORBIDDEN", "Legacy session bridge is disabled");
  } catch (error) {
    return err(error);
  }
}
