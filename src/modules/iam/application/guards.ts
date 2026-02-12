import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import type { PermissionKey } from "@/modules/iam/domain/permissions";
import { hasPermission } from "@/modules/iam/application/rbac";
import { resolveTenantFromRequest, requireMembership } from "@/modules/iam/application/tenant-context";
import { verifySessionToken } from "@/modules/iam/infrastructure/session";

export async function requireAuth(): Promise<IamPrincipal> {
  const cookieStore = await cookies();
  const token = cookieStore.get("iam_session")?.value ?? null;
  if (!token) {
    throw new IamError("UNAUTHORIZED", "Authentication required");
  }
  const principal = await verifySessionToken(token);
  if (!principal) {
    throw new IamError("UNAUTHORIZED", "Session expired or invalid");
  }
  return principal;
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

export async function requirePlatformAdmin(): Promise<IamPrincipal> {
  const principal = await requireAuth();
  if (principal.platformRole !== "SUPER_ADMIN") {
    throw new IamError("FORBIDDEN", "Platform admin access required");
  }
  return principal;
}

export async function requireStepUp(maxAgeMinutes = 10): Promise<IamPrincipal> {
  const principal = await requireTenantMembership();
  if (!principal.stepUpVerifiedAt) {
    throw new IamError("MFA_REQUIRED", "Step-up authentication required");
  }
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  if (Date.now() - principal.stepUpVerifiedAt.getTime() > maxAgeMs) {
    throw new IamError("MFA_REQUIRED", "Step-up authentication expired");
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
