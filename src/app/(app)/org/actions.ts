"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requirePermission, requirePlatformAdmin, requireStepUp, setActiveCompany } from "@/modules/iam";
import { ensureDefaultTenantRoles } from "@/modules/iam/application/bootstrap";
import { isSelfServeOrgCreationEnabled } from "@/modules/iam/application/feature-flags";
import {
  MASTER_ADMIN_ROLE_NAME,
  assertDirectMembershipRemovalAllowed,
  assertDirectRoleChangeAllowed,
  assertDirectStatusChangeAllowed,
  transferMasterAdmin,
} from "@/modules/iam/application/master-admin";
import { IamError } from "@/modules/iam/domain/errors";
import { createOrgSchema, invitePayloadSchema, roleUpsertSchema } from "@/modules/iam/interface/schemas";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

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
  const principal = isSelfServeOrgCreationEnabled()
    ? await requireAuth()
    : await requirePlatformAdmin();
  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid organization payload" };
  }

  const name = parsed.data.name.trim();
  const slug = parsed.data.slug?.trim();

  let company: { id: string };
  try {
    company = await prisma.company.create({
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Organization slug already exists" };
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
  await requireStepUp();

  const existing = await prisma.company.findUnique({
    where: { id: principal.activeCompanyId },
    select: {
      primaryDomain: true,
      allowedDomains: true,
      domainVerificationStatus: true,
    },
  });

  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  const primaryColor = String(formData.get("primaryColor") || "").trim() || null;
  const accentColor = String(formData.get("accentColor") || "").trim() || null;
  const fontFamily = String(formData.get("fontFamily") || "").trim() || null;
  const primaryDomain = String(formData.get("primaryDomain") || "").trim().toLowerCase() || null;
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
  const nextAllowedDomains = allowedDomainsRaw
    ? allowedDomainsRaw
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const previousAllowedDomains = Array.isArray(existing?.allowedDomains)
    ? existing.allowedDomains.map((value) => String(value).toLowerCase().trim()).filter(Boolean)
    : [];
  const domainsChanged =
    (existing?.primaryDomain ?? null) !== primaryDomain ||
    JSON.stringify(previousAllowedDomains) !== JSON.stringify(nextAllowedDomains);

  await prisma.company.update({
    where: { id: principal.activeCompanyId },
    data: {
      logoUrl,
      primaryColor,
      accentColor,
      fontFamily,
      primaryDomain,
      allowedDomains: nextAllowedDomains,
      domainVerificationStatus: domainsChanged ? "PENDING" : undefined,
      domainVerificationToken: domainsChanged ? null : undefined,
      domainVerificationGeneratedAt: domainsChanged ? null : undefined,
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

  await writeIamAudit({
    action: "POLICY_UPDATED",
    companyId: principal.activeCompanyId,
    actorUserId: principal.userId,
    entityType: "Company",
    entityId: principal.activeCompanyId,
    before: existing
      ? {
          primaryDomain: existing.primaryDomain,
          allowedDomains: existing.allowedDomains,
          domainVerificationStatus: existing.domainVerificationStatus,
        }
      : null,
    after: {
      primaryDomain,
      allowedDomains: nextAllowedDomains,
      domainVerificationStatus: domainsChanged ? "PENDING" : existing?.domainVerificationStatus,
      enabledMethods,
      mfaMode,
      turnstileEnabled,
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

  if (parsed.data.roleId) {
    const role = await prisma.iamRole.findUnique({
      where: { id: parsed.data.roleId },
      select: { id: true, companyId: true, name: true },
    });
    if (!role || role.companyId !== principal.activeCompanyId) {
      return { ok: false, error: "Invalid role for active tenant" };
    }
    if (role.name === MASTER_ADMIN_ROLE_NAME) {
      return { ok: false, error: "Master Admin invitations are not allowed from this page" };
    }
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
  const principal = await requirePermission("admin.members");
  await requireStepUp();
  const companyId = String(formData.get("companyId") || "");
  const userId = String(formData.get("userId") || "");
  const roleId = String(formData.get("roleId") || "");

  if (!companyId || !userId || !roleId) {
    return { ok: false, error: "Missing required fields" };
  }
  if (companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Cross-tenant role change is not allowed" };
  }

  const [membership, role] = await Promise.all([
    prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { role: true, status: true },
    }),
    prisma.iamRole.findUnique({
      where: { id: roleId },
      select: { id: true, companyId: true, name: true },
    }),
  ]);
  if (!membership) {
    return { ok: false, error: "Membership not found" };
  }
  if (!role || role.companyId !== companyId) {
    return { ok: false, error: "Invalid role for active tenant" };
  }

  try {
    assertDirectRoleChangeAllowed({
      currentRole: membership.role,
      currentStatus: membership.status,
      nextRole: role.name,
    });
    await getIdentityProvider().setRole({ companyId, userId, roleId });
  } catch (error) {
    if (error instanceof IamError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath("/org/members");
  return { ok: true };
}

export async function setMemberStatusAction(formData: FormData) {
  const principal = await requirePermission("admin.members");
  await requireStepUp();
  const companyId = String(formData.get("companyId") || "");
  const userId = String(formData.get("userId") || "");
  const status = String(formData.get("status") || "");

  if (!companyId || !userId || !status) {
    return { ok: false, error: "Missing required fields" };
  }
  if (companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Cross-tenant member update is not allowed" };
  }
  if (!["ACTIVE", "INVITED", "SUSPENDED"].includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true, status: true },
  });
  if (!membership) {
    return { ok: false, error: "Membership not found" };
  }

  try {
    assertDirectStatusChangeAllowed({
      currentRole: membership.role,
      currentStatus: membership.status,
      nextStatus: status,
    });
  } catch (error) {
    if (error instanceof IamError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  await prisma.companyMembership.update({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
    data: {
      status: status as "ACTIVE" | "INVITED" | "SUSPENDED",
    },
  });

  revalidatePath("/org/members");
  return { ok: true };
}

export async function removeMemberAction(formData: FormData) {
  const principal = await requirePermission("admin.members");
  const companyId = String(formData.get("companyId") || "");
  const userId = String(formData.get("userId") || "");

  if (!companyId || !userId) {
    return { ok: false, error: "Missing required fields" };
  }
  if (companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Cross-tenant member removal is not allowed" };
  }
  if (principal.userId === userId) {
    return { ok: false, error: "You cannot remove your own membership from this page" };
  }

  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true, status: true },
  });
  if (!membership) {
    return { ok: false, error: "Membership not found" };
  }

  try {
    assertDirectMembershipRemovalAllowed({
      currentRole: membership.role,
      currentStatus: membership.status,
    });
  } catch (error) {
    if (error instanceof IamError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  await prisma.companyMembership.delete({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
  });

  revalidatePath("/org/members");
  return { ok: true };
}

export async function transferMasterAdminAction(formData: FormData) {
  const principal = await requirePermission("admin.members");
  await requireStepUp();
  const companyId = String(formData.get("companyId") || "");
  const targetUserId = String(formData.get("targetUserId") || "");

  if (!companyId || !targetUserId) {
    return { ok: false, error: "Missing required fields" };
  }
  if (companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Cross-tenant transfer is not allowed" };
  }

  try {
    await transferMasterAdmin({
      companyId,
      actorUserId: principal.userId,
      nextOwnerUserId: targetUserId,
    });
  } catch (error) {
    if (error instanceof IamError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath("/org/members");
  return { ok: true };
}

export async function resendInviteAction(formData: FormData) {
  const principal = await requirePermission("admin.members");
  const invitationId = String(formData.get("invitationId") || "");
  if (!invitationId) {
    return { ok: false, error: "Missing invitationId" };
  }

  const invite = await prisma.iamInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      companyId: true,
      email: true,
      roleId: true,
      autoJoinRuleId: true,
      acceptedAt: true,
    },
  });

  if (!invite || invite.companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Invitation not found for active tenant" };
  }
  if (invite.acceptedAt) {
    return { ok: false, error: "Invitation already accepted" };
  }

  if (invite.roleId) {
    const role = await prisma.iamRole.findUnique({
      where: { id: invite.roleId },
      select: { name: true, companyId: true },
    });
    if (!role || role.companyId !== invite.companyId) {
      return { ok: false, error: "Invalid role in invitation" };
    }
    if (role.name === MASTER_ADMIN_ROLE_NAME) {
      return { ok: false, error: "Master Admin invitations are not allowed from this page" };
    }
  }

  await getIdentityProvider().inviteToOrg({
    companyId: invite.companyId,
    email: invite.email,
    roleId: invite.roleId,
    autoJoinRuleId: invite.autoJoinRuleId,
    createdByUserId: principal.userId,
  });
  await prisma.iamInvitation.delete({ where: { id: invite.id } });

  revalidatePath("/org/members");
  return { ok: true };
}

export async function cancelInviteAction(formData: FormData) {
  const principal = await requirePermission("admin.members");
  const invitationId = String(formData.get("invitationId") || "");
  if (!invitationId) {
    return { ok: false, error: "Missing invitationId" };
  }

  const invite = await prisma.iamInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      companyId: true,
      acceptedAt: true,
    },
  });

  if (!invite || invite.companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Invitation not found for active tenant" };
  }
  if (invite.acceptedAt) {
    return { ok: false, error: "Cannot cancel an accepted invitation" };
  }

  await prisma.iamInvitation.delete({
    where: { id: invite.id },
  });

  revalidatePath("/org/members");
  return { ok: true };
}

export async function createRoleAction(formData: FormData) {
  const principal = await requirePermission("admin.roles");
  await requireStepUp();

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

export async function upsertAutoJoinRuleAction(formData: FormData) {
  const principal = await requirePermission("admin.settings");
  await requireStepUp();

  const ruleId = String(formData.get("ruleId") || "").trim() || undefined;
  const ruleType = String(formData.get("ruleType") || "").trim();
  const domains = String(formData.get("domains") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowlist = String(formData.get("allowlist") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const requireAdminApproval = formData.get("requireAdminApproval") === "on";
  const isEnabled = formData.get("isEnabled") === "on";

  if (!["VERIFIED_DOMAIN", "EMAIL_ALLOWLIST", "MANUAL_APPROVAL"].includes(ruleType)) {
    return { ok: false, error: "Invalid ruleType" };
  }

  const previous = ruleId
    ? await prisma.iamAutoJoinRule.findUnique({
        where: { id: ruleId },
        select: {
          id: true,
          companyId: true,
          ruleType: true,
          config: true,
          isEnabled: true,
        },
      })
    : null;
  if (previous && previous.companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Cross-tenant auto-join update blocked" };
  }

  const updated = await getIdentityProvider().upsertAutoJoinRule({
    companyId: principal.activeCompanyId,
    ruleId,
    ruleType: ruleType as "VERIFIED_DOMAIN" | "EMAIL_ALLOWLIST" | "MANUAL_APPROVAL",
    config: {
      domains,
      allowlist,
      requireAdminApproval,
    },
    isEnabled,
  });

  await writeIamAudit({
    action: "POLICY_UPDATED",
    companyId: principal.activeCompanyId,
    actorUserId: principal.userId,
    entityType: "IamAutoJoinRule",
    entityId: updated.id,
    before: previous
      ? {
          ruleType: previous.ruleType,
          config: previous.config,
          isEnabled: previous.isEnabled,
        }
      : null,
    after: {
      ruleType: updated.ruleType,
      config: updated.config,
      isEnabled: updated.isEnabled,
    },
  });

  revalidatePath("/org/settings");
  return { ok: true };
}

export async function deleteAutoJoinRuleAction(formData: FormData) {
  const principal = await requirePermission("admin.settings");
  await requireStepUp();

  const ruleId = String(formData.get("ruleId") || "").trim();
  if (!ruleId) return { ok: false, error: "Missing ruleId" };

  const previous = await prisma.iamAutoJoinRule.findUnique({
    where: { id: ruleId },
    select: { id: true, companyId: true, ruleType: true, config: true, isEnabled: true },
  });
  if (!previous || previous.companyId !== principal.activeCompanyId) {
    return { ok: false, error: "Auto-join rule not found for active tenant" };
  }

  await getIdentityProvider().deleteAutoJoinRule({
    companyId: principal.activeCompanyId,
    ruleId,
  });

  await writeIamAudit({
    action: "POLICY_UPDATED",
    companyId: principal.activeCompanyId,
    actorUserId: principal.userId,
    entityType: "IamAutoJoinRule",
    entityId: ruleId,
    before: {
      ruleType: previous.ruleType,
      config: previous.config,
      isEnabled: previous.isEnabled,
    },
    after: { deleted: true },
  });

  revalidatePath("/org/settings");
  return { ok: true };
}

function buildVerificationToken(companyId: string, primaryDomain: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return `minierp-verify.${companyId}.${primaryDomain.toLowerCase()}.${nonce}`;
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function generateDomainVerificationTokenAction() {
  const principal = await requirePermission("admin.settings");
  await requireStepUp();

  const company = await prisma.company.findUnique({
    where: { id: principal.activeCompanyId },
    select: { id: true, primaryDomain: true, domainVerificationStatus: true },
  });
  if (!company?.primaryDomain) {
    return { ok: false, error: "Set a primary domain before generating a verification token" };
  }

  const token = buildVerificationToken(company.id, company.primaryDomain);
  const generatedAt = new Date();
  await prisma.company.update({
    where: { id: company.id },
    data: {
      domainVerificationToken: token,
      domainVerificationGeneratedAt: generatedAt,
      domainVerificationStatus: "PENDING",
    },
  });

  await writeIamAudit({
    action: "POLICY_UPDATED",
    companyId: principal.activeCompanyId,
    actorUserId: principal.userId,
    entityType: "CompanyDomainVerification",
    entityId: principal.activeCompanyId,
    before: { domainVerificationStatus: company.domainVerificationStatus },
    after: { domainVerificationStatus: "PENDING", generatedAt: generatedAt.toISOString() },
  });

  revalidatePath("/org/settings");
  return { ok: true, token };
}

export async function verifyDomainAction(formData: FormData) {
  const principal = await requirePermission("admin.settings");
  await requireStepUp();
  const token = String(formData.get("domainVerificationToken") || "").trim();
  if (!token) {
    return { ok: false, error: "Verification token is required" };
  }

  const company = await prisma.company.findUnique({
    where: { id: principal.activeCompanyId },
    select: {
      primaryDomain: true,
      domainVerificationStatus: true,
      domainVerificationToken: true,
      domainVerificationGeneratedAt: true,
    },
  });
  if (!company?.primaryDomain || !company.domainVerificationToken || !company.domainVerificationGeneratedAt) {
    return { ok: false, error: "Generate a token first" };
  }
  if (Date.now() - company.domainVerificationGeneratedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "Verification token expired. Generate a new token." };
  }
  if (!safeCompare(company.domainVerificationToken, token)) {
    return { ok: false, error: "Verification token invalid" };
  }

  await prisma.company.update({
    where: { id: principal.activeCompanyId },
    data: {
      domainVerificationStatus: "VERIFIED",
      domainVerificationToken: null,
      domainVerificationGeneratedAt: null,
    },
  });

  await writeIamAudit({
    action: "POLICY_UPDATED",
    companyId: principal.activeCompanyId,
    actorUserId: principal.userId,
    entityType: "CompanyDomainVerification",
    entityId: principal.activeCompanyId,
    before: { domainVerificationStatus: company.domainVerificationStatus },
    after: { domainVerificationStatus: "VERIFIED" },
  });

  revalidatePath("/org/settings");
  return { ok: true };
}
