import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequiredAppBaseUrl } from "@/lib/runtime-env";
import { IamError } from "@/modules/iam/domain/errors";
import type { IdentityProviderAdapter } from "@/modules/iam/domain/identity-provider";
import type { PermissionKey } from "@/modules/iam/domain/permissions";
import { defaultRoleDescriptions, defaultRolePermissions, permissionCatalog } from "@/modules/iam/domain/permissions";
import { parseMfaPolicy } from "@/modules/iam/application/policy";
import { hasPermission } from "@/modules/iam/application/rbac";
import {
  clearSessionCookie,
  createSessionRecord,
  listSessionsForUser,
  revokeAllSessionsForUser,
  revokeSessionById,
  rotateSession,
  setSessionCookie,
  verifySessionToken,
} from "@/modules/iam/infrastructure/session";
import { consumeMagicLink, sendMagicLink as sendMagicLinkMessage } from "@/modules/iam/infrastructure/magic-link";
import { sendOtp as sendOtpCode, verifyOtp as verifyOtpCode } from "@/modules/iam/infrastructure/otp";
import { buildOtpAuthUri, generateBase32Secret, verifyTotp } from "@/modules/iam/infrastructure/totp";
import { encryptText, hashToken, randomToken } from "@/modules/iam/infrastructure/crypto";
import { getNotificationService } from "@/modules/iam/infrastructure/notifications";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("iam_dummy_password", 12);

function safeInt(value: string | undefined, fallback: number, min = 1, max = 86_400): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function isInviteSignupBridgeEnabled(): boolean {
  const explicit = process.env.IAM_INVITE_SIGNUP_BRIDGE_ENABLED;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return true;
}

async function ensurePermissionSeed() {
  const keys = Object.keys(permissionCatalog) as PermissionKey[];
  for (const key of keys) {
    const meta = permissionCatalog[key];
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
      update: {
        description: defaultRoleDescriptions[roleName] ?? roleName,
      },
      select: { id: true },
    });

    for (const permissionKey of allowed) {
      const permissionId = permissionMap.get(permissionKey);
      if (!permissionId) continue;
      await prisma.iamRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }
}

async function getDefaultCompanyForUser(userId: string): Promise<{ companyId: string; role: string }> {
  const membership = await prisma.companyMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { companyId: true, role: true },
  });

  if (!membership) {
    throw new IamError("FORBIDDEN", "No active tenant membership");
  }

  return membership;
}

async function assertLoginAttemptLimit(email: string, ip?: string | null): Promise<void> {
  const windowSeconds = safeInt(process.env.IAM_LOGIN_FAILED_WINDOW_SECONDS, 15 * 60, 30, 24 * 60 * 60);
  const maxFailedByEmail = safeInt(process.env.IAM_LOGIN_MAX_FAILED_EMAIL_ATTEMPTS, 10, 1, 200);
  const maxFailedByIp = safeInt(process.env.IAM_LOGIN_MAX_FAILED_IP_ATTEMPTS, 30, 1, 500);
  const since = new Date(Date.now() - windowSeconds * 1000);

  const failedByEmail = await prisma.iamLoginAttempt.count({
    where: {
      email,
      result: "FAILED",
      createdAt: { gte: since },
    },
  });

  if (failedByEmail >= maxFailedByEmail) {
    throw new IamError("RATE_LIMITED", "Too many failed sign-in attempts. Try again later.");
  }

  if (ip) {
    const failedByIp = await prisma.iamLoginAttempt.count({
      where: {
        ip,
        result: "FAILED",
        createdAt: { gte: since },
      },
    });

    if (failedByIp >= maxFailedByIp) {
      throw new IamError("RATE_LIMITED", "Too many failed sign-in attempts. Try again later.");
    }
  }
}

export class LocalIdentityProvider implements IdentityProviderAdapter {
  async signUp(input: {
    email: string;
    password: string;
    name: string;
    companyName?: string;
    companySlug?: string;
    inviteToken?: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<{ sessionId: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existing) {
      throw new IamError("CONFLICT", "Email is already registered");
    }

    const useInviteBridge = Boolean(input.inviteToken && isInviteSignupBridgeEnabled());
    const invitePreview = useInviteBridge ? await this.previewInvite(input.inviteToken as string) : null;
    if (invitePreview && invitePreview.email !== normalizedEmail) {
      throw new IamError("FORBIDDEN_EMAIL_MISMATCH", "Invitation email must match the sign-up email");
    }

    const companyId =
      invitePreview?.companyId ??
      (
        await prisma.company.create({
          data: {
            name: input.companyName || `${input.name}'s Company`,
            slug: input.companySlug ?? randomToken(6).toLowerCase(),
            status: "ACTIVE",
            allowedAuthMethods: ["PASSWORD", "MAGIC_LINK", "OAUTH_GOOGLE", "OAUTH_MICROSOFT"],
            mfaPolicy: { mode: "OPTIONAL", enforceForRoles: ["OWNER", "ADMIN"], allowOtpFallback: true },
            sessionPolicy: {
              idleTimeoutMinutes: 30,
              absoluteTimeoutMinutes: 480,
              rememberMeAbsoluteTimeoutMinutes: 43200,
              rotateEveryMinutes: 15,
            },
            botProtectionPolicy: { turnstileEnabled: false, rateLimitWindowSeconds: 60, rateLimitMaxAttempts: 8 },
          },
          select: { id: true },
        })
      ).id;

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: input.name,
        companyId,
        activeCompanyId: companyId,
        role: invitePreview ? "MEMBER" : "OWNER",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    await ensureCompanyRoles(companyId);

    if (invitePreview && input.inviteToken) {
      await this.claimInvite({
        token: input.inviteToken,
        userId: user.id,
        userEmail: normalizedEmail,
      });
    } else {
      const ownerRole = await prisma.iamRole.findUnique({
        where: { companyId_name: { companyId, name: "OWNER" } },
        select: { id: true },
      });

      await prisma.companyMembership.create({
        data: {
          userId: user.id,
          companyId,
          role: "OWNER",
          roleId: ownerRole?.id ?? null,
          status: "ACTIVE",
          isDefault: true,
          joinedAt: new Date(),
        },
      });
    }

    const created = await createSessionRecord({
      userId: user.id,
      companyId,
      ip: input.ip,
      userAgent: input.userAgent,
      rememberMe: false,
    });

    await setSessionCookie(created.token, created.expiresAt);

    await writeIamAudit({
      action: "AUTH_SIGNUP",
      companyId,
      actorUserId: user.id,
      entityType: "User",
      entityId: user.id,
      metadata: invitePreview
        ? {
            invitationId: invitePreview.invitationId,
            companyId,
          }
        : undefined,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return { sessionId: created.sessionId };
  }

  async signIn(input: {
    email: string;
    password?: string;
    companyIdHint?: string;
    ip?: string | null;
    userAgent?: string | null;
    rememberMe?: boolean;
  }): Promise<{ sessionId: string; mfaRequired?: boolean }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    await assertLoginAttemptLimit(normalizedEmail, input.ip);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!user) {
      await bcrypt.compare(input.password ?? randomToken(16), DUMMY_PASSWORD_HASH);
      await prisma.iamLoginAttempt.create({
        data: {
          email: normalizedEmail,
          result: "FAILED",
          reasonCode: "INVALID_CREDENTIALS",
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
      throw new IamError("UNAUTHORIZED", "Invalid credentials");
    }

    if (user.status !== "ACTIVE") {
      await prisma.iamLoginAttempt.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          result: "FAILED",
          reasonCode: "ACCOUNT_INACTIVE",
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
      throw new IamError("FORBIDDEN", "User account is not active");
    }

    if (!input.password) {
      await prisma.iamLoginAttempt.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          result: "FAILED",
          reasonCode: "PASSWORD_MISSING",
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
      throw new IamError("VALIDATION_ERROR", "Password is required");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      await prisma.iamLoginAttempt.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          result: "FAILED",
          reasonCode: "INVALID_CREDENTIALS",
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
      throw new IamError("UNAUTHORIZED", "Invalid credentials");
    }

    const membership = input.companyIdHint
      ? await prisma.companyMembership.findUnique({
          where: { userId_companyId: { userId: user.id, companyId: input.companyIdHint } },
          select: { companyId: true, role: true, status: true },
        })
      : await getDefaultCompanyForUser(user.id);

    if (!membership || ("status" in membership && membership.status !== "ACTIVE")) {
      throw new IamError("FORBIDDEN", "No active membership");
    }

    const companyId = membership.companyId;
    await ensureCompanyRoles(companyId);

    const mfaPolicy = parseMfaPolicy(
      (await prisma.company.findUnique({ where: { id: companyId }, select: { mfaPolicy: true } }))?.mfaPolicy,
    );
    const hasMfaFactor =
      (await prisma.iamMfaFactor.count({
        where: { userId: user.id, isVerified: true },
      })) > 0;

    const mfaRequiredByPolicy =
      mfaPolicy.mode === "REQUIRED_FOR_ALL" ||
      (mfaPolicy.mode === "REQUIRED_FOR_ADMINS" && ["OWNER", "ADMIN"].includes(membership.role));
    const mfaRequired = mfaRequiredByPolicy;

    if (mfaRequiredByPolicy && !hasMfaFactor) {
      await writeIamAudit({
        action: "AUTH_LOGIN_FAILED",
        companyId,
        actorUserId: user.id,
        entityType: "User",
        entityId: user.id,
        after: { reason: "MFA_NOT_ENROLLED" },
        ip: input.ip,
        userAgent: input.userAgent,
      });
    }

    const created = await createSessionRecord({
      userId: user.id,
      companyId,
      ip: input.ip,
      userAgent: input.userAgent,
      rememberMe: input.rememberMe,
    });

    await setSessionCookie(created.token, created.expiresAt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        activeCompanyId: companyId,
      },
    });

    await prisma.iamLoginAttempt.create({
      data: {
        userId: user.id,
        companyId,
        email: normalizedEmail,
        result: "SUCCESS",
        reasonCode: "AUTH_LOGIN",
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    await writeIamAudit({
      action: "AUTH_LOGIN",
      companyId,
      actorUserId: user.id,
      entityType: "User",
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return { sessionId: created.sessionId, mfaRequired };
  }

  async verifySession(sessionToken: string | null | undefined) {
    if (!sessionToken) return null;
    return verifySessionToken(sessionToken);
  }

  async rotateSession(sessionToken: string): Promise<string> {
    const next = await rotateSession(sessionToken);
    if (!next) throw new IamError("UNAUTHORIZED", "Session cannot be rotated");
    await setSessionCookie(next.token, next.expiresAt);
    return next.token;
  }

  async revokeSession(sessionId: string, actorUserId?: string): Promise<void> {
    const session = await prisma.iamSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, companyId: true },
    });

    if (session && actorUserId && session.userId !== actorUserId) {
      const actor = await prisma.user.findUnique({
        where: { id: actorUserId },
        select: { platformRole: true },
      });
      if (actor?.platformRole !== "SUPER_ADMIN") {
        throw new IamError("FORBIDDEN", "Not allowed to revoke another user's session");
      }
    }

    await revokeSessionById(sessionId, "ADMIN_REVOKE");
    await writeIamAudit({
      action: "SESSION_REVOKED",
      companyId: session?.companyId ?? null,
      actorUserId: actorUserId ?? null,
      entityType: "IamSession",
      entityId: sessionId,
    });
  }

  async revokeAllSessionsForUser(userId: string, actorUserId?: string): Promise<void> {
    if (actorUserId && actorUserId !== userId) {
      const actor = await prisma.user.findUnique({
        where: { id: actorUserId },
        select: { platformRole: true },
      });
      if (actor?.platformRole !== "SUPER_ADMIN") {
        throw new IamError("FORBIDDEN", "Not allowed to revoke sessions for another user");
      }
    }

    await revokeAllSessionsForUser(userId, "USER_REVOKE_ALL");
    if (!actorUserId || actorUserId === userId) {
      await clearSessionCookie();
    }
    await writeIamAudit({
      action: "SESSION_REVOKE_ALL",
      actorUserId: actorUserId ?? userId,
      entityType: "User",
      entityId: userId,
    });
  }

  async listUserSessions(userId: string) {
    return listSessionsForUser(userId);
  }

  async sendMagicLink(input: { email: string; redirectTo?: string }): Promise<void> {
    await sendMagicLinkMessage({ email: input.email, redirectTo: input.redirectTo });
    await writeIamAudit({
      action: "MAGIC_LINK_SENT",
      entityType: "User",
      entityId: input.email,
    });
  }

  async verifyMagicLink(input: { token: string; ip?: string | null; userAgent?: string | null }): Promise<{ sessionId: string }> {
    const consumed = await consumeMagicLink(input.token);
    const { companyId } = await getDefaultCompanyForUser(consumed.userId);

    const created = await createSessionRecord({
      userId: consumed.userId,
      companyId,
      ip: input.ip,
      userAgent: input.userAgent,
      rememberMe: false,
    });

    await setSessionCookie(created.token, created.expiresAt);

    await writeIamAudit({
      action: "MAGIC_LINK_VERIFIED",
      companyId,
      actorUserId: consumed.userId,
      entityType: "User",
      entityId: consumed.userId,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return { sessionId: created.sessionId };
  }

  async sendOtp(input: {
    destination: string;
    channel: "EMAIL" | "SMS";
    purpose: string;
    userId?: string;
    companyId?: string;
    ip?: string | null;
  }): Promise<void> {
    await sendOtpCode(input);
    await writeIamAudit({
      action: "OTP_SENT",
      companyId: input.companyId,
      actorUserId: input.userId,
      entityType: "OtpChallenge",
      entityId: input.destination,
      ip: input.ip,
    });
  }

  async verifyOtp(input: { destination: string; code: string; purpose: string }): Promise<{ ok: true }> {
    await verifyOtpCode(input);
    await writeIamAudit({
      action: "OTP_VERIFIED",
      entityType: "OtpChallenge",
      entityId: input.destination,
    });
    return { ok: true };
  }

  async enrollMfa(input: { userId: string; label?: string }): Promise<{ secret: string; otpauthUri: string; recoveryCodes: string[] }> {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (!user) throw new IamError("NOT_FOUND", "User not found");

    const secret = generateBase32Secret();
    const otpauthUri = buildOtpAuthUri("miniERP", user.email, secret);

    const factor = await prisma.iamMfaFactor.create({
      data: {
        userId: input.userId,
        type: "TOTP",
        label: input.label ?? "Authenticator",
        secretEnc: encryptText(secret),
      },
      select: { id: true },
    });

    const recoveryCodes = Array.from({ length: 10 }, () => randomToken(8));
    for (const code of recoveryCodes) {
      await prisma.iamRecoveryCode.create({
        data: {
          userId: input.userId,
          factorId: factor.id,
          codeHash: hashToken(code),
        },
      });
    }

    await writeIamAudit({
      action: "MFA_ENROLLED",
      actorUserId: input.userId,
      entityType: "IamMfaFactor",
      entityId: factor.id,
    });

    return { secret, otpauthUri, recoveryCodes };
  }

  async verifyMfa(input: { userId: string; code: string }): Promise<{ ok: true }> {
    const factor = await prisma.iamMfaFactor.findFirst({
      where: { userId: input.userId, type: "TOTP" },
      orderBy: { createdAt: "desc" },
    });

    if (!factor || !factor.secretEnc) {
      throw new IamError("NOT_FOUND", "MFA factor not found");
    }

    const { decryptText } = await import("@/modules/iam/infrastructure/crypto");
    const secret = decryptText(factor.secretEnc);
    const valid = verifyTotp(secret, input.code, 1, 30);
    if (!valid) {
      throw new IamError("TOKEN_INVALID", "Invalid MFA code");
    }

    await prisma.iamMfaFactor.update({
      where: { id: factor.id },
      data: {
        isVerified: true,
        verifiedAt: factor.verifiedAt ?? new Date(),
        lastUsedAt: new Date(),
      },
    });

    await prisma.iamSession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { stepUpVerifiedAt: new Date() },
    });

    await writeIamAudit({
      action: "MFA_CHALLENGE_VERIFIED",
      actorUserId: input.userId,
      entityType: "IamMfaFactor",
      entityId: factor.id,
    });

    return { ok: true };
  }

  async resolveTenantTheme(input: { host?: string | null; companyId?: string | null }) {
    const host = input.host?.split(":")[0]?.toLowerCase() ?? null;
    let company: {
      logoUrl: string | null;
      primaryColor: string | null;
      accentColor: string | null;
      fontFamily: string | null;
      cssVars: unknown;
      customCss: string | null;
    } | null = null;

    try {
      company = await prisma.company.findFirst({
        where: input.companyId
          ? { id: input.companyId }
          : host
            ? {
                OR: [
                  { primaryDomain: host },
                  { allowedDomains: { array_contains: host } as never },
                ],
              }
            : undefined,
        select: {
          logoUrl: true,
          primaryColor: true,
          accentColor: true,
          fontFamily: true,
          cssVars: true,
          customCss: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2021" || error.code === "P2022")
      ) {
        return null;
      }
      throw error;
    }

    if (!company) return null;

    return {
      logoUrl: company.logoUrl,
      primaryColor: company.primaryColor,
      accentColor: company.accentColor,
      fontFamily: company.fontFamily,
      cssVars: company.cssVars as Record<string, string> | null,
      customCss: company.customCss,
    };
  }

  async listOrgMembers(companyId: string) {
    const rows = await prisma.companyMembership.findMany({
      where: { companyId },
      select: {
        userId: true,
        status: true,
        role: true,
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      status: m.status,
    }));
  }

  async previewInvite(token: string): Promise<{
    invitationId: string;
    companyId: string;
    companyName: string;
    email: string;
    expiresAt: Date;
  }> {
    const tokenHash = hashToken(token);
    const invitation = await prisma.iamInvitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        companyId: true,
        email: true,
        expiresAt: true,
        acceptedAt: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!invitation) throw new IamError("TOKEN_INVALID", "Invite token is invalid");
    if (invitation.acceptedAt) throw new IamError("TOKEN_INVALID", "Invite already accepted");
    if (invitation.expiresAt <= new Date()) throw new IamError("TOKEN_EXPIRED", "Invite token expired");

    return {
      invitationId: invitation.id,
      companyId: invitation.companyId,
      companyName: invitation.company.name,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    };
  }

  async inviteToOrg(input: {
    companyId: string;
    email: string;
    roleId?: string | null;
    createdByUserId: string;
    autoJoinRuleId?: string | null;
  }): Promise<{ invitationId: string }> {
    const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { name: true, logoUrl: true } });
    if (!company) throw new IamError("NOT_FOUND", "Tenant not found");

    const token = randomToken(32);
    const tokenHash = hashToken(token);
    const invitation = await prisma.iamInvitation.create({
      data: {
        companyId: input.companyId,
        email: input.email.trim().toLowerCase(),
        roleId: input.roleId ?? null,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByUserId: input.createdByUserId,
        autoJoinRuleId: input.autoJoinRuleId ?? null,
      },
      select: { id: true },
    });

    const baseUrl = getRequiredAppBaseUrl();
    const url = new URL("/api/invites/accept", baseUrl);
    url.searchParams.set("token", token);

    await getNotificationService().sendInviteEmail({
      to: input.email,
      companyName: company.name,
      invitationUrl: url.toString(),
      logoUrl: company.logoUrl,
    });

    await writeIamAudit({
      action: "INVITE_SENT",
      companyId: input.companyId,
      actorUserId: input.createdByUserId,
      entityType: "IamInvitation",
      entityId: invitation.id,
      metadata: {
        invitationId: invitation.id,
        email: input.email.trim().toLowerCase(),
      },
    });

    return { invitationId: invitation.id };
  }

  async claimInvite(input: { token: string; userId: string; userEmail: string }): Promise<void> {
    const tokenHash = hashToken(input.token);
    const invitation = await prisma.iamInvitation.findUnique({
      where: { tokenHash }, select: {
        id: true,
        companyId: true,
        roleId: true,
        email: true,
        expiresAt: true,
        acceptedAt: true,
      },
    });

    if (!invitation) throw new IamError("TOKEN_INVALID", "Invite token is invalid");
    if (invitation.acceptedAt) throw new IamError("TOKEN_INVALID", "Invite already accepted");
    if (invitation.expiresAt <= new Date()) throw new IamError("TOKEN_EXPIRED", "Invite token expired");
    const normalizedEmail = input.userEmail.trim().toLowerCase();
    if (invitation.email !== normalizedEmail) {
      throw new IamError("FORBIDDEN_EMAIL_MISMATCH", "Invite token is not issued for this email");
    }

    const role = invitation.roleId
      ? await prisma.iamRole.findUnique({ where: { id: invitation.roleId }, select: { id: true, name: true, companyId: true } })
      : await prisma.iamRole.findUnique({ where: { companyId_name: { companyId: invitation.companyId, name: "MEMBER" } }, select: { id: true, name: true } });
    if (role && "companyId" in role && role.companyId !== invitation.companyId) {
      throw new IamError("VALIDATION_ERROR", "Invite role does not belong to this tenant");
    }
    const resolvedRoleName = role?.name ?? "MEMBER";
    const resolvedRoleId = role?.id ?? null;

    await prisma.$transaction([
      prisma.companyMembership.upsert({
        where: {
          userId_companyId: {
            userId: input.userId,
            companyId: invitation.companyId,
          },
        },
        create: {
          userId: input.userId,
          companyId: invitation.companyId,
          role: resolvedRoleName,
          roleId: resolvedRoleId,
          status: "ACTIVE",
          joinedAt: new Date(),
        },
        update: {
          status: "ACTIVE",
          role: resolvedRoleName,
          roleId: resolvedRoleId,
          joinedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: input.userId },
        data: {
          activeCompanyId: invitation.companyId,
          companyId: invitation.companyId,
          role: resolvedRoleName,
        },
      }),
      prisma.iamInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    await writeIamAudit({
      action: "INVITE_ACCEPTED",
      companyId: invitation.companyId,
      actorUserId: input.userId,
      entityType: "IamInvitation",
      entityId: invitation.id,
      metadata: {
        invitationId: invitation.id,
        claimedBy: normalizedEmail,
      },
    });
  }

  async acceptInvite(input: { token: string; userId: string }): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    if (!user) {
      throw new IamError("NOT_FOUND", "User not found");
    }
    await this.claimInvite({
      token: input.token,
      userId: input.userId,
      userEmail: user.email,
    });
  }

  async setRole(input: { companyId: string; userId: string; roleId: string }): Promise<void> {
    const role = await prisma.iamRole.findUnique({
      where: { id: input.roleId },
      select: { id: true, name: true, companyId: true },
    });

    if (!role || role.companyId !== input.companyId) {
      throw new IamError("VALIDATION_ERROR", "Invalid role for tenant");
    }

    await prisma.companyMembership.update({
      where: {
        userId_companyId: {
          userId: input.userId,
          companyId: input.companyId,
        },
      },
      data: {
        role: role.name,
        roleId: role.id,
      },
    });

    const member = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    if (member?.email) {
      const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { name: true } });
      await getNotificationService().sendRoleChanged({
        to: member.email,
        roleName: role.name,
        companyName: company?.name ?? "your organization",
      });
    }
  }

  async checkPermission(input: { userId: string; companyId: string; permission: PermissionKey }): Promise<boolean> {
    return hasPermission(input.userId, input.companyId, input.permission);
  }
}
