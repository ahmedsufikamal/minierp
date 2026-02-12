import type { IamPrincipal } from "@/modules/iam/domain/types";
import { createSessionRecord } from "@/modules/iam/infrastructure/session";

export async function bridgeLegacyPrincipalToIamSession(input: {
  principal: IamPrincipal;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}) {
  return createSessionRecord({
    userId: input.principal.userId,
    companyId: input.principal.activeCompanyId,
    rememberMe: false,
    ip: input.ip,
    userAgent: input.userAgent,
    requestId: input.requestId,
  });
}
