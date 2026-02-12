"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requirePermission, setActiveCompany } from "@/modules/iam";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { invitePayloadSchema, roleUpsertSchema } from "@/modules/iam/interface/schemas";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";

export async function switchOrgAction(formData: FormData) {
  const principal = await requireAuth();
  const companyId = String(formData.get("companyId") || "");
  if (!companyId) return { ok: false, error: "Missing companyId" };

  await setActiveCompany(principal.userId, companyId);

  const cookieStore = await cookies();
  cookieStore.set("iam_active_org", companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/");
  return { ok: true };
}

export async function createOrgAction(formData: FormData) {
  const principal = await requireAuth();
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  if (!name) return { ok: false, error: "Organization name is required" };

  const company = await prisma.company.create({
    data: {
      name,
      slug: slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
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
  });

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

  await prisma.companyMembership.create({
    data: {
      userId: principal.userId,
      companyId: company.id,
      role: "OWNER",
      roleId: ownerRole?.id ?? null,
      status: "ACTIVE",
      isDefault: false,
      joinedAt: new Date(),
    },
  });

  await setActiveCompany(principal.userId, company.id);
  const cookieStore = await cookies();
  cookieStore.set("iam_active_org", company.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/org/select");
  revalidatePath("/org/settings");
  return { ok: true, companyId: company.id };
}

export async function saveOrgSettingsAction(formData: FormData) {
  const principal = await requirePermission("admin.settings");

  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  const primaryColor = String(formData.get("primaryColor") || "").trim() || null;
  const accentColor = String(formData.get("accentColor") || "").trim() || null;
  const fontFamily = String(formData.get("fontFamily") || "").trim() || null;
  const primaryDomain = String(formData.get("primaryDomain") || "").trim() || null;
  const allowedDomainsRaw = String(formData.get("allowedDomains") || "").trim();

  const allowedAuthMethods = {
    PASSWORD: formData.get("auth_password") === "on",
    MAGIC_LINK: formData.get("auth_magic_link") === "on",
    OAUTH_GOOGLE: formData.get("auth_google") === "on",
    OAUTH_MICROSOFT: formData.get("auth_microsoft") === "on",
  };

  const enabledMethods = Object.entries(allowedAuthMethods)
    .filter(([, enabled]) => enabled)
    .map(([method]) => method);

  const mfaMode = String(formData.get("mfaMode") || "OPTIONAL");
  const turnstileEnabled = formData.get("turnstileEnabled") === "on";

  await prisma.company.update({
    where: { id: principal.activeCompanyId },
    data: {
      logoUrl,
      primaryColor,
      accentColor,
      fontFamily,
      primaryDomain,
      allowedDomains: allowedDomainsRaw
        ? allowedDomainsRaw
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean)
        : [],
      allowedAuthMethods: enabledMethods,
      mfaPolicy: {
        mode: mfaMode,
        enforceForRoles: ["OWNER", "ADMIN"],
        allowOtpFallback: true,
      },
      botProtectionPolicy: {
        turnstileEnabled,
        rateLimitWindowSeconds: 60,
        rateLimitMaxAttempts: 8,
      },
    },
  });

  revalidatePath("/org/settings");
  return { ok: true };
}

export async function inviteMemberAction(formData: FormData) {
  const principal = await requirePermission("admin.members");

  const parsed = invitePayloadSchema.safeParse({
    email: formData.get("email"),
    roleId: formData.get("roleId") || null,
    autoJoinRuleId: null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invite payload" };
  }

  await getIdentityProvider().inviteToOrg({
    companyId: principal.activeCompanyId,
    email: parsed.data.email,
    roleId: parsed.data.roleId,
    createdByUserId: principal.userId,
  });

  revalidatePath("/org/members");
  return { ok: true };
}

export async function changeMemberRoleAction(formData: FormData) {
  await requirePermission("admin.members");
  const companyId = String(formData.get("companyId") || "");
  const userId = String(formData.get("userId") || "");
  const roleId = String(formData.get("roleId") || "");

  if (!companyId || !userId || !roleId) {
    return { ok: false, error: "Missing required fields" };
  }

  await getIdentityProvider().setRole({ companyId, userId, roleId });
  revalidatePath("/org/members");
  return { ok: true };
}

export async function createRoleAction(formData: FormData) {
  const principal = await requirePermission("admin.roles");

  const permissionKeys = formData
    .getAll("permissionKeys")
    .map((v) => String(v))
    .filter(Boolean);

  const parsed = roleUpsertSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    permissionKeys,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid role payload" };
  }

  const role = await prisma.iamRole.create({
    data: {
      companyId: principal.activeCompanyId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isSystem: false,
    },
    select: { id: true },
  });

  if (parsed.data.permissionKeys.length > 0) {
    const permissions = await prisma.iamPermission.findMany({
      where: { key: { in: parsed.data.permissionKeys } },
      select: { id: true },
    });

    await prisma.iamRolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/org/roles");
  return { ok: true };
}
