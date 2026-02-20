import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PlatformError } from "@/modules/platform/domain/errors";

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function parseHost(host: string | null): string | null {
  if (!host) return null;
  return host.split(":")[0]?.toLowerCase() ?? null;
}

export async function resolveTenantIdFromHost(hostHeader: string | null): Promise<string | null> {
  const host = parseHost(hostHeader);
  if (!host) return null;

  try {
    const tenantDomain = await prisma.tenantDomain.findUnique({
      where: { domain: host },
      select: { tenantId: true },
    });

    if (tenantDomain?.tenantId) {
      return tenantDomain.tenantId;
    }

    const company = await prisma.company.findFirst({
      where: {
        OR: [{ primaryDomain: host }, { allowedDomains: { array_contains: host } as never }],
      },
      select: { tenantId: true, id: true },
    });

    return company?.tenantId ?? null;
  } catch (error) {
    if (isSchemaMismatch(error)) {
      const company = await prisma.company.findFirst({
        where: {
          OR: [{ primaryDomain: host }, { allowedDomains: { array_contains: host } as never }],
        },
        select: { id: true },
      });
      return company?.id ?? null;
    }

    throw error;
  }
}

export async function resolveTenantForCompany(companyId: string): Promise<string> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true },
    });

    if (!company) {
      throw new PlatformError("NOT_FOUND", "Company not found");
    }

    if (company.tenantId) return company.tenantId;

    // Compatibility fallback for legacy company-scoped environments.
    return company.id;
  } catch (error) {
    if (isSchemaMismatch(error)) {
      return companyId;
    }
    throw error;
  }
}

export async function assertCompanyBelongsToTenant(companyId: string, tenantId: string): Promise<void> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, tenantId: true },
    });

    if (!company) {
      throw new PlatformError("NOT_FOUND", "Company not found");
    }

    const resolvedTenantId = company.tenantId ?? company.id;
    if (resolvedTenantId !== tenantId) {
      throw new PlatformError("FORBIDDEN", "Company does not belong to tenant");
    }
  } catch (error) {
    if (isSchemaMismatch(error)) {
      if (companyId !== tenantId) {
        throw new PlatformError("FORBIDDEN", "Company does not belong to tenant");
      }
      return;
    }

    throw error;
  }
}
