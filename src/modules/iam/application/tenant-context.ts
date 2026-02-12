import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";

function parseHost(host: string | null): string | null {
  if (!host) return null;
  return host.split(":")[0]?.toLowerCase() ?? null;
}

export async function resolveTenantFromRequest(): Promise<string | null> {
  const h = await headers();
  const host = parseHost(h.get("host"));

  if (host) {
    const company = await prisma.company.findFirst({
      where: {
        OR: [{ primaryDomain: host }, { allowedDomains: { array_contains: host } as never }],
      },
      select: { id: true },
    });

    if (company?.id) return company.id;
  }

  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("iam_active_org")?.value;
  if (activeCompanyId) return activeCompanyId;

  return null;
}

export async function requireMembership(userId: string, companyId: string): Promise<{ role: string; roleId: string | null }> {
  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true, roleId: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new IamError("FORBIDDEN", "No membership for active tenant");
  }

  return { role: membership.role, roleId: membership.roleId ?? null };
}
