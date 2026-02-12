import { setLegacySessionCookie, syncLegacyFromIamSession } from "@/lib/session";
import { IamError } from "@/modules/iam/domain/errors";
import { bridgeLegacyPrincipalToIamSession } from "@/modules/iam/application/session-bridge";
import { resolvePrincipalFromCookies } from "@/modules/iam/application/principal-resolver";
import { setSessionCookie } from "@/modules/iam/infrastructure/session";
import { getRequestContext } from "@/modules/iam/interface/request-context";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { err, ok } from "@/modules/iam/interface/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const resolved = await resolvePrincipalFromCookies({ allowLegacyFallback: true });
    if (!resolved.principal) {
      throw new IamError("UNAUTHORIZED", "Authentication required");
    }

    if (resolved.source === "iam") {
      await syncLegacyFromIamSession();
      return ok({ bridged: false, reason: "already_iam" });
    }

    if (resolved.source !== "legacy") {
      throw new IamError("UNAUTHORIZED", "Authentication required");
    }

    const ctx = getRequestContext(request);
    const created = await bridgeLegacyPrincipalToIamSession({
      principal: resolved.principal,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    await setSessionCookie(created.token, created.expiresAt);
    await setLegacySessionCookie({
      userId: resolved.principal.userId,
      companyId: resolved.principal.activeCompanyId,
      email: resolved.principal.email,
      name: resolved.principal.name,
      expiresAt: created.expiresAt,
    });

    return ok({ bridged: true });
  } catch (error) {
    return err(error);
  }
}
