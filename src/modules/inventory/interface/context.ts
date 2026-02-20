import { Prisma } from "@prisma/client";
import { ApiKeyAuthError, authenticateApiKeyRequest, getApiKeyCompatibilityHeaders, hasApiKeyCredential } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { mapUserRoleToInventoryRole } from "@/modules/inventory/application/policy";
import { resolvePrincipalFromTokens } from "@/modules/iam/application/principal-resolver";

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
): Promise<{ userId: string; role: string; companyId: string; tenantId?: string; iamPermissions?: string[]; responseHeaders?: Record<string, string> }> {
  if (hasApiKeyCredential(request)) {
    try {
      const auth = await authenticateApiKeyRequest(request, "inventory");
      return {
        userId: "api-key",
        role: "COMPANY_ADMIN",
        companyId: auth.companyId,
        tenantId: auth.companyId,
        iamPermissions: [],
        responseHeaders: getApiKeyCompatibilityHeaders(auth),
      };
    } catch (error) {
      if (error instanceof ApiKeyAuthError) {
        if (error.code === "MISSING_COMPANY_CONTEXT") {
          throw new InventoryError("VALIDATION_ERROR", error.message);
        }
        if (error.code === "MISSING_API_KEY_CONFIG") {
          throw new InventoryError("INTERNAL_ERROR", error.message);
        }
        throw new InventoryError("UNAUTHORIZED", error.message);
      }
      throw error;
    }
  }

  const cookieHeader = request.headers.get("cookie");
  const resolved = await resolvePrincipalFromTokens(
    {
      iamSessionToken: parseCookie(cookieHeader, "iam_session"),
      legacySessionToken: parseCookie(cookieHeader, "session"),
    },
    { allowLegacyFallback: true },
  );

  if (!resolved.principal) {
    throw new InventoryError("UNAUTHORIZED", "Authentication required");
  }

  const principal = resolved.principal;
  const requestedCompanyId = request.headers.get("x-company-id") ?? principal.activeCompanyId;
  if (requestedCompanyId !== principal.activeCompanyId) {
    try {
      const membership = await prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId: principal.userId, companyId: requestedCompanyId } },
        select: { role: true, companyId: true, status: true },
      });
      if (!membership || membership.status !== "ACTIVE") {
        throw new InventoryError("FORBIDDEN", "No access to requested company");
      }
      return {
        userId: principal.userId,
        role: membership.role,
        companyId: membership.companyId,
        tenantId: membership.companyId,
        iamPermissions: principal.permissions,
        responseHeaders: undefined,
      };
    } catch (error: unknown) {
      if (error instanceof InventoryError) throw error;
      if (!isSchemaMismatch(error)) {
        throw error;
      }
      // Membership table may not exist before migration; keep principal-scoped tenant.
      return {
        userId: principal.userId,
        role: principal.membershipRole,
        companyId: principal.activeCompanyId,
        tenantId: principal.activeCompanyId,
        iamPermissions: principal.permissions,
        responseHeaders: undefined,
      };
    }
  }

  const base = {
    userId: principal.userId,
    role: principal.membershipRole,
    companyId: requestedCompanyId,
    tenantId: requestedCompanyId,
    iamPermissions: principal.permissions,
    responseHeaders: undefined,
  };

  try {
    const company = await prisma.company.findUnique({
      where: { id: requestedCompanyId },
      select: { tenantId: true },
    });
    return {
      ...base,
      tenantId: company?.tenantId ?? requestedCompanyId,
    };
  } catch (error: unknown) {
    if (!isSchemaMismatch(error)) {
      throw error;
    }
    return base;
  };
}

export async function getInventoryRequestContext(request: Request): Promise<InventoryRequestContext> {
  const resolved = await resolveUserContext(request);
  return {
    requestId: getRequestId(request),
    tenantId: resolved.tenantId,
    companyId: resolved.companyId,
    userId: resolved.userId,
    role: mapUserRoleToInventoryRole(resolved.role),
    iamPermissions: resolved.iamPermissions,
    responseHeaders: resolved.responseHeaders,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
