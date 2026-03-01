import { redirect } from "next/navigation";
import { hasPermission as hasRbacPermission } from "@/modules/iam/application/rbac";
import { requireTenantMembership } from "@/modules/iam/application/guards";
import { isIamError } from "@/modules/iam/domain/errors";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import { hasTradePermission, tradePermissionAliases, type TradePermission } from "@/modules/trade/domain/types";

function withNextParam(path: string, nextPath: string): string {
  const [base, existing] = path.split("?", 2);
  const query = new URLSearchParams(existing ?? "");
  query.set("next", nextPath);
  return `${base}?${query.toString()}`;
}

function redirectForAuthError(error: unknown, nextPath: string): never {
  if (isIamError(error)) {
    if (error.code === "UNAUTHORIZED") {
      redirect(withNextParam("/auth/sign-in", nextPath));
    }
    if (error.code === "PASSWORD_RESET_REQUIRED") {
      redirect(withNextParam("/auth/reset-password", nextPath));
    }
    if (error.code === "MFA_REQUIRED" || error.code === "STEP_UP_REQUIRED") {
      redirect(withNextParam("/auth/mfa?required=1", nextPath));
    }
    if (error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
  }
  throw error;
}

export async function requireTradePermissionPage(
  permission: TradePermission,
  nextPath: string,
): Promise<IamPrincipal> {
  try {
    const principal = await requireTenantMembership();
    if (principal.effectiveLevel >= 5) {
      return principal;
    }
    if (hasTradePermission(principal, permission)) {
      return principal;
    }

    const candidates = [permission, ...(tradePermissionAliases[permission] ?? [])];
    for (const candidate of candidates) {
      if (await hasRbacPermission(principal.userId, principal.activeCompanyId, candidate as never)) {
        return principal;
      }
    }

    redirect("/dashboard");
  } catch (error) {
    redirectForAuthError(error, nextPath);
  }
}
