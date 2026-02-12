import { prisma } from "@/lib/prisma";
import { defaultRoleDescriptions, defaultRolePermissions, type PermissionKey } from "@/modules/iam/domain/permissions";
import { createSessionRecord, setSessionCookie } from "@/modules/iam/infrastructure/session";
import { exchangeOAuthCode, type OAuthProvider } from "@/modules/iam/infrastructure/oauth";
import { verifyOAuthState } from "@/modules/iam/infrastructure/oauth-state";

async function ensurePermissionSeed() {
  const catalog = await import("@/modules/iam/domain/permissions");
  for (const [key, meta] of Object.entries(catalog.permissionCatalog)) {
    await prisma.iamPermission.upsert({
      where: { key },
      create: {
        key,
        module: meta.module,
        description: meta.description,
      },
      update: {
        module: meta.module,
        description: meta.description,
      },
    });
  }
}

async function ensureCompanyRoles(companyId: string) {
  await ensurePermissionSeed();
  const permissions = await prisma.iamPermission.findMany({ select: { id: true, key: true } });
  const permissionMap = new Map(permissions.map((p) => [p.key, p.id]));

  for (const [roleName, allowed] of Object.entries(defaultRolePermissions)) {
    const role = await prisma.iamRole.upsert({
      where: { companyId_name: { companyId, name: roleName } },
      create: {
        companyId,
        name: roleName,
        description: defaultRoleDescriptions[roleName] ?? roleName,
        isSystem: true,
        isDefault: roleName === "OWNER",
      },
      update: {},
      select: { id: true },
    });

    for (const key of allowed as PermissionKey[]) {
      const permissionId = permissionMap.get(key);
      if (!permissionId) continue;
      await prisma.iamRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }
}

export async function completeOAuthSignIn(input: {
  provider: OAuthProvider;
  code: string;
  state: string;
  redirectUri: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await verifyOAuthState(input.state);

  const profile = await exchangeOAuthCode({
    provider: input.provider,
    code: input.code,
    redirectUri: input.redirectUri,
  });

  const oauth = await prisma.iamOAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: profile.providerUserId,
      },
    },
    select: { userId: true },
  });

  let userId = oauth?.userId;
  if (!userId) {
    const existing = await prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } });
    if (existing) {
      userId = existing.id;
    }
  }

  if (!userId) {
    const company = await prisma.company.create({
      data: {
        name: `${profile.name}'s Company`,
        slug: `org-${Math.random().toString(36).slice(2, 8)}`,
        status: "ACTIVE",
        allowedAuthMethods: ["PASSWORD", "MAGIC_LINK", "OAUTH_GOOGLE", "OAUTH_MICROSOFT"],
      },
      select: { id: true },
    });

    const user = await prisma.user.create({
      data: {
        email: profile.email,
        passwordHash: "oauth-managed",
        name: profile.name,
        companyId: company.id,
        activeCompanyId: company.id,
        role: "OWNER",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await ensureCompanyRoles(company.id);
    const ownerRole = await prisma.iamRole.findUnique({
      where: { companyId_name: { companyId: company.id, name: "OWNER" } },
      select: { id: true },
    });

    await prisma.companyMembership.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: "OWNER",
        roleId: ownerRole?.id ?? null,
        status: "ACTIVE",
        isDefault: true,
        joinedAt: new Date(),
      },
    });

    userId = user.id;
  }

  await prisma.iamOAuthAccount.upsert({
    where: {
      provider_providerUserId: {
        provider: input.provider,
        providerUserId: profile.providerUserId,
      },
    },
    create: {
      userId,
      provider: input.provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
    },
    update: {
      userId,
      email: profile.email,
    },
  });

  const membership = await prisma.companyMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { companyId: true },
  });

  if (!membership) {
    throw new Error("No active membership available for OAuth user");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { activeCompanyId: membership.companyId },
  });

  const created = await createSessionRecord({
    userId,
    companyId: membership.companyId,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  await setSessionCookie(created.token, created.expiresAt);
}
