import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { parseAllowedAuthMethods } from "@/modules/iam/application/policy";
import { parseSearch, ok, err } from "@/modules/iam/interface/http";
import { authConfigQuerySchema } from "@/modules/iam/interface/schemas";

export async function GET(request: Request) {
  try {
    const query = parseSearch(request, authConfigQuerySchema);
    const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? null;

    const company = await prisma.company.findFirst({
      where: query.companyId
        ? { id: query.companyId }
        : host
          ? {
              OR: [{ primaryDomain: host }, { allowedDomains: { array_contains: host } as never }],
            }
          : undefined,
      select: {
        id: true,
        logoUrl: true,
        name: true,
        allowedAuthMethods: true,
      },
    });

    return ok({
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      logoUrl: company?.logoUrl ?? null,
      allowedAuthMethods: parseAllowedAuthMethods(company?.allowedAuthMethods),
    });
  } catch (error) {
    return err(error);
  }
}
