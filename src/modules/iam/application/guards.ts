import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IamError, isIamError } from "@/modules/iam/domain/errors";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import { permissionCatalog, type PermissionKey } from "@/modules/iam/domain/permissions";
import { hasPermission } from "@/modules/iam/application/rbac";
import {
  type AuthzAction,
  USER_TYPE_LEVEL,
  assertCanManageTargetLevel,
  assertPermissionAllowedByLevel,
  isOrgAdminOrHigher,
  permissionToModuleAction,
} from "@/modules/iam/application/level-policy";
import { resolveTenantFromRequest, requireMembership } from "@/modules/iam/application/tenant-context";
import { resolvePrincipalFromCookies } from "@/modules/iam/application/principal-resolver";

export async function requireAuth(options: { allowMfaPending?: boolean } = {}): Promise<IamPrincipal> {
  const resolved = await resolvePrincipalFromCookies();
  if (!resolved.principal) {
    throw new IamError("UNAUTHORIZED", "Authentication required");
  }
  const principal = resolved.principal;
  if (principal.mustResetPassword) {
    throw new IamError("PASSWORD_RESET_REQUIRED", "Password reset is required before continuing");
  }
  if (principal.mfaRequired && !options.allowMfaPending) {
    throw new IamError("MFA_REQUIRED", "Multi-factor authentication verification required");
  }
  return principal;
}

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
  }
  throw error;
}

export async function requireAuthPage(nextPath: string, options: { allowMfaPending?: boolean } = {}): Promise<IamPrincipal> {
  try {
    return await requireAuth(options);
  } catch (error) {
    redirectForAuthError(error, nextPath);
  }
}

export async function requireTenantMembership(): Promise<IamPrincipal> {
  const principal = await requireAuth();
  const tenantFromHostOrCookie = await resolveTenantFromRequest();
  const companyId = tenantFromHostOrCookie ?? principal.activeCompanyId;
  const membership = await requireMembership(principal.userId, companyId);

  return {
    ...principal,
    activeCompanyId: companyId,
    membershipRole: membership.role,
    userTypeLevel: membership.userTypeLevel as 2 | 3 | 4 | 5 | 9,
    effectiveLevel:
      principal.platformRole === "SUPER_ADMIN"
        ? USER_TYPE_LEVEL.SUPER_USER
        : (membership.userTypeLevel as 2 | 3 | 4 | 5 | 9),
    activeMembershipStatus: membership.status,
  };
}

export async function requirePermission(permission: PermissionKey): Promise<IamPrincipal> {
  const principal = await requireTenantMembership();
  if (principal.effectiveLevel === USER_TYPE_LEVEL.SUPER_USER || principal.effectiveLevel === USER_TYPE_LEVEL.MASTER_USER) {
    return principal;
  }
  assertPermissionAllowedByLevel(principal.effectiveLevel, permission);
  const allowed = await hasPermission(principal.userId, principal.activeCompanyId, permission);
  if (!allowed) {
    throw new IamError("FORBIDDEN", `Missing permission: ${permission}`);
  }
  return principal;
}

export async function requirePermissionPage(permission: PermissionKey, nextPath: string): Promise<IamPrincipal> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    redirectForAuthError(error, nextPath);
  }
}

export async function requirePlatformAdmin(): Promise<IamPrincipal> {
  const principal = await requireAuth();
  if (principal.effectiveLevel !== USER_TYPE_LEVEL.SUPER_USER) {
    throw new IamError("FORBIDDEN", "Platform admin access required");
  }
  return principal;
}

export async function requirePlatformAdminPage(nextPath: string): Promise<IamPrincipal> {
  try {
    return await requirePlatformAdmin();
  } catch (error) {
    if (isIamError(error) && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    redirectForAuthError(error, nextPath);
  }
}

export async function requireStepUp(maxAgeMinutes = 10): Promise<IamPrincipal> {
  const principal = await requireAuth();
  if (!principal.stepUpVerifiedAt) {
    throw new IamError("STEP_UP_REQUIRED", "Step-up authentication required");
  }
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  if (Date.now() - principal.stepUpVerifiedAt.getTime() > maxAgeMs) {
    throw new IamError("STEP_UP_REQUIRED", "Step-up authentication expired");
  }
  return principal;
}

export async function canUI(permission: PermissionKey): Promise<boolean> {
  try {
    const principal = await requireTenantMembership();
    if (principal.effectiveLevel === USER_TYPE_LEVEL.SUPER_USER || principal.effectiveLevel === USER_TYPE_LEVEL.MASTER_USER) {
      return true;
    }
    assertPermissionAllowedByLevel(principal.effectiveLevel, permission);
    return hasPermission(principal.userId, principal.activeCompanyId, permission);
  } catch {
    return false;
  }
}

export async function setActiveCompany(userId: string, companyId: string): Promise<void> {
  await requireMembership(userId, companyId);
  await prisma.user.update({
    where: { id: userId },
    data: { activeCompanyId: companyId },
  });
}

export async function requireMinLevel(level: 2 | 3 | 4 | 5 | 9): Promise<IamPrincipal> {
  const principal = await requireTenantMembership();
  if (principal.effectiveLevel < level) {
    throw new IamError("FORBIDDEN", `Requires level ${level} or higher`);
  }
  return principal;
}

export async function requireOrgAdminOrHigher(): Promise<IamPrincipal> {
  const principal = await requireTenantMembership();
  if (!isOrgAdminOrHigher(principal.effectiveLevel)) {
    throw new IamError("FORBIDDEN", "Organization admin level required");
  }
  return principal;
}

export function assertManageableLevel(actor: IamPrincipal, targetLevel: 2 | 3 | 4 | 5 | 9): void {
  assertCanManageTargetLevel(actor.effectiveLevel, targetLevel);
}

export async function requireSuperUser(): Promise<IamPrincipal> {
  return requireMinLevel(9);
}

export async function requirePermissionForAction(moduleName: string, action: AuthzAction): Promise<IamPrincipal> {
  const candidates = (Object.keys(permissionCatalog) as PermissionKey[]).filter((permission) => {
    const parsed = permissionToModuleAction(permission);
    return parsed.module === moduleName && parsed.action === action;
  });

  if (candidates.length === 0) {
    throw new IamError("FORBIDDEN", `No permission mapping found for ${moduleName}.${action}`);
  }

  let lastError: unknown = null;
  for (const permission of candidates) {
    try {
      return await requirePermission(permission);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof IamError) {
    throw lastError;
  }
  throw new IamError("FORBIDDEN", `Missing permission for ${moduleName}.${action}`);
}
