import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requirePlatformAdmin } from "@/modules/iam";
import { isSelfServeOrgCreationEnabled } from "@/modules/iam/application/feature-flags";
import { getUserTypeLabelForLevel, mapRoleToUserTypeLevel } from "@/modules/iam/application/level-policy";
import { IamError } from "@/modules/iam/domain/errors";
import { parseBody, ok, err } from "@/modules/iam/interface/http";
import { assertSameOrigin } from "@/modules/iam/interface/origin";
import { createOrgSchema } from "@/modules/iam/interface/schemas";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";

export async function GET() {
  try {
    const principal = await requireAuth();
    const orgs = await prisma.companyMembership.findMany({
      where: { userId: principal.userId, status: "ACTIVE" },
      select: {
        companyId: true,
        role: true,
        userTypeLevel: true,
        isDefault: true,
        company: {
          select: {
            name: true,
            slug: true,
            status: true,
            primaryDomain: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return ok(orgs.map((o) => ({
      id: o.companyId,
      name: o.company.name,
      slug: o.company.slug,
      role: o.role,
      userTypeLevel: o.userTypeLevel,
      isDefault: o.isDefault,
      status: o.company.status,
      primaryDomain: o.company.primaryDomain,
    })));
  } catch (error) {
    return err(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const principal = isSelfServeOrgCreationEnabled()
      ? await requireAuth()
      : await requirePlatformAdmin();
    const body = await parseBody(request, createOrgSchema);

    let company: { id: string; name: string; slug: string | null };
    try {
      company = await prisma.company.create({
        data: {
          name: body.name,
          slug: body.slug ?? `${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
          status: "ACTIVE",
          allowedAuthMethods: ["PASSWORD", "MAGIC_LINK", "OAUTH_GOOGLE", "OAUTH_MICROSOFT"],
          mfaPolicy: { mode: "OPTIONAL", enforceForRoles: ["OWNER", "ADMIN"], allowOtpFallback: true },
          sessionPolicy: {
            idleTimeoutMinutes: 30,
            absoluteTimeoutMinutes: 480,
            rememberMeAbsoluteTimeoutMinutes: 43200,
            rotateEveryMinutes: 15,
          },
          botProtectionPolicy: {
            turnstileEnabled: false,
            rateLimitWindowSeconds: 60,
            rateLimitMaxAttempts: 8,
          },
        },
        select: { id: true, name: true, slug: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new IamError("CONFLICT", "Organization slug already exists");
      }
      throw error;
    }

    await ensureDefaultTenantRoles(company.id);

    const ownerRole = await prisma.iamRole.findUnique({
      where: {
        companyId_name: {
          companyId: company.id,
          name: "OWNER",
        },
      },
      select: { id: true },
    });

    await prisma.companyMembership.upsert({
      where: {
        userId_companyId: {
          userId: principal.userId,
          companyId: company.id,
        },
      },
      create: {
        userId: principal.userId,
        companyId: company.id,
        role: "OWNER",
        roleId: ownerRole?.id ?? null,
        userTypeLevel: mapRoleToUserTypeLevel("OWNER"),
        userTypeLabel: getUserTypeLabelForLevel(mapRoleToUserTypeLevel("OWNER")),
        status: "ACTIVE",
        isDefault: false,
        joinedAt: new Date(),
      },
      update: {
        role: "OWNER",
        roleId: ownerRole?.id ?? null,
        userTypeLevel: mapRoleToUserTypeLevel("OWNER"),
        userTypeLabel: getUserTypeLabelForLevel(mapRoleToUserTypeLevel("OWNER")),
        status: "ACTIVE",
      },
    });

    await prisma.inventoryCompanySetting.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        itemNamingBy: "ITEM_CODE",
        defaultValuationMethod: "FIFO",
        allowNegativeStock: false,
        preventNegativeStock: true,
        allowNegativeOverride: false,
        trackByLocation: false,
        costingMethod: "AVG",
        baseCurrency: "BDT",
        version: 1,
      },
      update: {},
    });

    return ok(company, { status: 201 });
  } catch (error) {
    return err(error);
  }
}
