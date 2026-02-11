import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/session";
import { InventoryError } from "@/modules/inventory/domain/errors";
import type { InventoryRequestContext } from "@/modules/inventory/domain/types";
import { mapUserRoleToInventoryRole } from "@/modules/inventory/application/policy";

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

function getApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return new URL(request.url).searchParams.get("apiKey");
}

async function resolveUserContext(request: Request): Promise<{ userId: string; role: string; companyId: string }> {
  const apiKey = getApiKey(request);
  if (apiKey && process.env.API_KEY && apiKey === process.env.API_KEY) {
    const companyId = request.headers.get("x-company-id") || process.env.API_ORG_ID || "default-org";
    return { userId: "api-key", role: "COMPANY_ADMIN", companyId };
  }

  const sessionCookie = parseCookie(request.headers.get("cookie"), "session");
  const session = await decrypt(sessionCookie ?? undefined);
  if (!session?.userId) {
    throw new InventoryError("UNAUTHORIZED", "Authentication required");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, companyId: true },
  });

  if (!user) {
    throw new InventoryError("UNAUTHORIZED", "User not found");
  }

  const requestedCompanyId = request.headers.get("x-company-id") ?? session.companyId;
  if (requestedCompanyId !== session.companyId) {
    try {
      const membership = await prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId: user.id, companyId: requestedCompanyId } },
      });
      if (!membership) {
        throw new InventoryError("FORBIDDEN", "No access to requested company");
      }
      return { userId: user.id, role: membership.role, companyId: membership.companyId };
    } catch (error: unknown) {
      if (error instanceof InventoryError) throw error;
      // Membership table may not exist before migration; fallback to session company.
      return { userId: user.id, role: user.role, companyId: session.companyId };
    }
  }

  return { userId: user.id, role: user.role, companyId: requestedCompanyId };
}

export async function getInventoryRequestContext(request: Request): Promise<InventoryRequestContext> {
  const resolved = await resolveUserContext(request);
  return {
    requestId: getRequestId(request),
    companyId: resolved.companyId,
    userId: resolved.userId,
    role: mapUserRoleToInventoryRole(resolved.role),
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
