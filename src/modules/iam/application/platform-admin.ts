import { Prisma, type IamPlatformRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IamError } from "@/modules/iam/domain/errors";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { isPlatformRoleManagementEnabled } from "@/modules/iam/application/feature-flags";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export async function updateUserPlatformRole(input: {
  actorUserId: string;
  targetUserId: string;
  nextRole: IamPlatformRole;
}): Promise<{ userId: string; platformRole: IamPlatformRole }> {
  if (!isPlatformRoleManagementEnabled()) {
    throw new IamError("FORBIDDEN", "Platform role management is disabled.");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, platformRole: true, status: true },
  });
  if (!target) {
    throw new IamError("NOT_FOUND", "User not found");
  }

  if (
    target.platformRole === "SUPER_ADMIN" &&
    input.nextRole !== "SUPER_ADMIN" &&
    target.status === "ACTIVE"
  ) {
    const activeSuperAdmins = await prisma.user.count({
      where: { platformRole: "SUPER_ADMIN", status: "ACTIVE" },
    });
    if (activeSuperAdmins <= 1) {
      throw new IamError("VALIDATION_ERROR", "Cannot demote the last active Super Admin.");
    }
  }

  const updated = await prisma.user.update({
    where: { id: input.targetUserId },
    data: { platformRole: input.nextRole },
    select: { id: true, platformRole: true },
  });

  await writeIamAudit({
    action: "ROLE_CHANGED",
    actorUserId: input.actorUserId,
    entityType: "User",
    entityId: updated.id,
    before: { platformRole: target.platformRole },
    after: { platformRole: updated.platformRole },
    metadata: { scope: "platform" },
  });

  return {
    userId: updated.id,
    platformRole: updated.platformRole,
  };
}

export async function createTenantWithMasterAdminInvite(input: {
  actorUserId: string;
  name: string;
  slug?: string;
  masterAdminEmail: string;
}): Promise<{ companyId: string; invitationId: string }> {
  const name = input.name.trim();
  const slug = input.slug?.trim();
  const masterAdminEmail = input.masterAdminEmail.trim().toLowerCase();

  let company: { id: string; slug: string | null };
  try {
    company = await prisma.$transaction(async (tx) => {
      const tenantKeyBase = slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const tenantKey = `${tenantKeyBase}-${Math.random().toString(36).slice(2, 6)}`;
      const tenant = await tx.tenant.create({
        data: {
          key: tenantKey,
          name,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      return tx.company.create({
        data: {
          tenantId: tenant.id,
          name,
          slug: slug ?? `${tenantKeyBase}-${Math.random().toString(36).slice(2, 6)}`,
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
        select: { id: true, slug: true },
      });
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
  const invited = await getIdentityProvider().inviteToOrg({
    companyId: company.id,
    email: masterAdminEmail,
    roleId: ownerRole?.id ?? null,
    createdByUserId: input.actorUserId,
  });

  await writeIamAudit({
    action: "POLICY_UPDATED",
    companyId: company.id,
    actorUserId: input.actorUserId,
    entityType: "Company",
    entityId: company.id,
    after: {
      createdByPlatformAdmin: true,
      masterAdminInviteEmail: masterAdminEmail,
      slug: company.slug,
    },
  });

  return {
    companyId: company.id,
    invitationId: invited.invitationId,
  };
}
