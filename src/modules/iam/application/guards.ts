import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IamError, isIamError } from "@/modules/iam/domain/errors";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import type { PermissionKey } from "@/modules/iam/domain/permissions";
import { hasPermission } from "@/modules/iam/application/rbac";
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
  };
}

export async function requirePermission(permission: PermissionKey): Promise<IamPrincipal> {
  const principal = await requireTenantMembership();
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
  if (principal.platformRole !== "SUPER_ADMIN") {
    throw new IamError("FORBIDDEN", "Platform admin access required");
  }
  return principal;
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
