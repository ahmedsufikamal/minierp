import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePrincipalFromTokens } from "@/modules/iam/application/principal-resolver";
import { PlatformError } from "@/modules/platform/domain/errors";
import type { PlatformRequestContext } from "@/modules/platform/domain/types";
import { resolveTenantForCompany, resolveTenantIdFromHost } from "@/modules/platform/application/tenant-context.service";

function parseCookie(raw: string | null, name: string): string | null {
  if (!raw) return null;
  const cookies = raw.split(";");
  for (const c of cookies) {
    const [k, ...rest] = c.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function getRequestIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? undefined;
}

function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function resolveUserContext(
  request: Request,
): Promise<{
  tenantId: string;
  companyId: string;
  userId: string;
  role: string;
  platformRole: "SUPER_ADMIN" | "SUPPORT" | "NONE";
  permissions: string[];
}> {
  const cookieHeader = request.headers.get("cookie");
  const resolved = await resolvePrincipalFromTokens(
    {
      iamSessionToken: parseCookie(cookieHeader, "iam_session"),
      legacySessionToken: parseCookie(cookieHeader, "session"),
    },
    { allowLegacyFallback: true },
  );

  if (!resolved.principal) {
    throw new PlatformError("UNAUTHORIZED", "Authentication required");
  }

  const principal = resolved.principal;
  const requestedCompanyId = request.headers.get("x-company-id") ?? principal.activeCompanyId;

  let role = principal.membershipRole;
  if (requestedCompanyId !== principal.activeCompanyId) {
    try {
      const membership = await prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId: principal.userId, companyId: requestedCompanyId } },
        select: { role: true, status: true },
      });
      if (!membership || membership.status !== "ACTIVE") {
        throw new PlatformError("FORBIDDEN", "No access to requested company");
      }
      role = membership.role;
    } catch (error) {
      if (error instanceof PlatformError) throw error;
      if (!isSchemaMismatch(error)) throw error;
      // Compatibility fallback when membership table is unavailable.
    }
  }

  const tenantId = await resolveTenantForCompany(requestedCompanyId);
  const hostTenantId = await resolveTenantIdFromHost(request.headers.get("host"));
  if (hostTenantId && hostTenantId !== tenantId && principal.platformRole !== "SUPER_ADMIN") {
    throw new PlatformError("FORBIDDEN", "Tenant host does not match company context");
  }

  return {
    tenantId,
    companyId: requestedCompanyId,
    userId: principal.userId,
    role,
    platformRole: principal.platformRole,
    permissions: principal.permissions,
  };
}

export async function getPlatformRequestContext(request: Request): Promise<PlatformRequestContext> {
  const resolved = await resolveUserContext(request);
  return {
    requestId: getRequestId(request),
    tenantId: resolved.tenantId,
    companyId: resolved.companyId,
    userId: resolved.userId,
    role: resolved.role,
    platformRole: resolved.platformRole,
    permissions: resolved.permissions,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
