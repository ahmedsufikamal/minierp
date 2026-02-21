import { getCompanyIdOrUserId } from "@/lib/auth";
import { resolvePrincipalFromCookies } from "@/modules/iam/application/principal-resolver";

export async function getInventoryCompanyScopeId(): Promise<string> {
  const resolved = await resolvePrincipalFromCookies();
  if (resolved.principal?.activeCompanyId) {
    return resolved.principal.activeCompanyId;
  }
  return getCompanyIdOrUserId();
}
