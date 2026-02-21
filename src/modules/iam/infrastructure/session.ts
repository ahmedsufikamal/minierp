import { cookies } from "next/headers";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionCookieDomain } from "@/lib/runtime-env";
import { hashToken, randomToken } from "@/modules/iam/infrastructure/crypto";
import { parseMfaPolicy, parseSessionPolicy } from "@/modules/iam/application/policy";
import { mapRoleToUserTypeLevel, resolveEffectiveUserTypeLevel } from "@/modules/iam/application/level-policy";
import { getPermissionsForUserCompany } from "@/modules/iam/application/rbac";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import { IamError } from "@/modules/iam/domain/errors";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

const COOKIE_NAME = "iam_session";

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isMissingRequestScope(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("outside a request scope") || message.includes("next-dynamic-api-wrong-context");
}

async function getCookieStore() {
  try {
    return await cookies();
  } catch (error) {
    if (isMissingRequestScope(error)) {
      return null;
    }
    throw error;
  }
}

function parseMinutes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.floor(value);
}

export async function createSessionRecord(input: {
  userId: string;
  companyId: string;
  rememberMe?: boolean;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  let mustResetPassword = false;
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { mustResetPassword: true },
    });
    mustResetPassword = Boolean(user?.mustResetPassword);
  } catch (error) {
    if (!isSchemaMismatch(error)) {
      throw error;
    }
  }

  if (mustResetPassword) {
    throw new IamError("PASSWORD_RESET_REQUIRED", "Password reset required before session creation");
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { sessionPolicy: true },
  });

  const policy = parseSessionPolicy(company?.sessionPolicy);
  const now = Date.now();
  const idleMinutes = parseMinutes(policy.idleTimeoutMinutes);
  const absoluteMinutes = input.rememberMe
    ? parseMinutes(policy.rememberMeAbsoluteTimeoutMinutes)
    : parseMinutes(policy.absoluteTimeoutMinutes);

  const idleExpiresAt = new Date(now + idleMinutes * 60 * 1000);
  const expiresAt = new Date(now + absoluteMinutes * 60 * 1000);
  const token = randomToken(40);
  const sessionTokenHash = hashToken(token);

  const session = await prisma.iamSession.create({
    data: {
      sessionTokenHash,
      userId: input.userId,
      companyId: input.companyId,
      rememberMe: Boolean(input.rememberMe),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
      idleExpiresAt,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  return { token, sessionId: session.id, expiresAt: session.expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await getCookieStore();
  if (!cookieStore) return;
  const domain = getSessionCookieDomain();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await getCookieStore();
  if (!cookieStore) return;
  const domain = getSessionCookieDomain();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}

export async function verifySessionToken(sessionToken: string): Promise<IamPrincipal | null> {
  try {
    const sessionTokenHash = hashToken(sessionToken);
    const now = new Date();

  let session:
    | {
        id: string;
        userId: string;
        companyId: string;
        stepUpVerifiedAt: Date | null;
        revokedAt: Date | null;
        idleExpiresAt: Date;
        expiresAt: Date;
        ip: string | null;
        userAgent: string | null;
        company: { mfaPolicy: unknown } | null;
        user: { email: string; name: string; platformRole: "SUPER_ADMIN" | "SUPPORT" | "NONE"; mustResetPassword: boolean };
        impersonation: { actorUserId: string; expiresAt: Date; endedAt: Date | null } | null;
      }
    | null = null;

  try {
    session = await prisma.iamSession.findUnique({
      where: { sessionTokenHash },
      select: {
        id: true,
        userId: true,
        companyId: true,
        stepUpVerifiedAt: true,
        revokedAt: true,
        idleExpiresAt: true,
        expiresAt: true,
        ip: true,
        userAgent: true,
        company: {
          select: { mfaPolicy: true },
        },
        user: {
          select: {
            email: true,
            name: true,
            platformRole: true,
            mustResetPassword: true,
          },
        },
        impersonation: {
          select: {
            actorUserId: true,
            expiresAt: true,
            endedAt: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isSchemaMismatch(error)) {
      throw error;
    }

    const legacySession = await prisma.iamSession.findUnique({
      where: { sessionTokenHash },
      select: {
        id: true,
        userId: true,
        companyId: true,
        stepUpVerifiedAt: true,
        revokedAt: true,
        idleExpiresAt: true,
        expiresAt: true,
        ip: true,
        userAgent: true,
        company: {
          select: { mfaPolicy: true },
        },
        user: {
          select: {
            email: true,
            name: true,
            platformRole: true,
          },
        },
        impersonation: {
          select: {
            actorUserId: true,
            expiresAt: true,
            endedAt: true,
          },
        },
      },
    });

    session = legacySession
      ? {
          ...legacySession,
          user: {
            ...legacySession.user,
            mustResetPassword: false,
          },
        }
      : null;
  }

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt <= now) return null;
  if (session.idleExpiresAt <= now) return null;
  if (session.impersonation?.endedAt) {
    await prisma.iamSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokeReason: "SECURITY_EVENT",
      },
    });
    return null;
  }
  if (session.impersonation && session.impersonation.expiresAt <= now) {
    const endedAt = new Date();
    const [, ended] = await prisma.$transaction([
      prisma.iamSession.update({
        where: { id: session.id },
        data: {
          revokedAt: endedAt,
          revokeReason: "SECURITY_EVENT",
        },
      }),
      prisma.iamImpersonationSession.updateMany({
        where: {
          sessionId: session.id,
          endedAt: null,
        },
        data: {
          endedAt,
        },
      }),
    ]);

    if (ended.count > 0) {
      await writeIamAudit({
        action: "IMPERSONATION_ENDED",
        companyId: session.companyId,
        actorUserId: session.impersonation.actorUserId,
        entityType: "IamImpersonationSession",
        entityId: session.id,
        metadata: { reason: "EXPIRED", expiresAt: session.impersonation.expiresAt.toISOString() },
        ip: session.ip ?? null,
        userAgent: session.userAgent ?? null,
      });
    }
    return null;
  }

  let membership:
    | {
        role: string;
        status: "ACTIVE" | "INVITED" | "SUSPENDED";
        userTypeLevel: number;
      }
    | null = null;
  try {
    membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: session.userId, companyId: session.companyId } },
      select: { role: true, status: true, userTypeLevel: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      const fallback = await prisma.companyMembership.findUnique({
        where: { userId_companyId: { userId: session.userId, companyId: session.companyId } },
        select: { role: true, status: true },
      });
      membership = fallback
        ? {
            ...fallback,
            userTypeLevel: mapRoleToUserTypeLevel(fallback.role),
          }
        : null;
    } else {
      throw error;
    }
  }

  if (!membership || membership.status !== "ACTIVE") return null;
  const mfaPolicy = parseMfaPolicy(session.company?.mfaPolicy);
  const mfaRequiredByPolicy =
    mfaPolicy.mode === "REQUIRED_FOR_ALL" ||
    (mfaPolicy.mode === "REQUIRED_FOR_ADMINS" && ["OWNER", "ADMIN"].includes(membership.role));
  const mfaRequired = mfaRequiredByPolicy && !session.stepUpVerifiedAt;

  const permissions = await getPermissionsForUserCompany(session.userId, session.companyId);
  const effectiveLevel = resolveEffectiveUserTypeLevel({
    platformRole: session.user.platformRole,
    membershipRole: membership.role,
    membershipLevel: membership.userTypeLevel,
  });
  const deviceFingerprint = crypto
    .createHash("sha256")
    .update(`${session.ip ?? "unknown"}|${session.userAgent ?? "unknown"}`)
    .digest("hex");

    return {
      userId: session.userId,
      email: session.user.email,
      name: session.user.name,
      platformRole: session.user.platformRole,
      activeCompanyId: session.companyId,
      membershipRole: membership.role,
      userTypeLevel: membership.userTypeLevel as 2 | 3 | 4 | 5 | 9,
      effectiveLevel,
      activeMembershipStatus: membership.status,
      permissions,
      sessionId: session.id,
      stepUpVerifiedAt: session.stepUpVerifiedAt,
      mfaRequired,
      mustResetPassword: session.user.mustResetPassword,
      isImpersonating: Boolean(session.impersonation && !session.impersonation.endedAt),
      impersonatorUserId: session.impersonation?.actorUserId ?? null,
      impersonationExpiresAt: session.impersonation?.expiresAt ?? null,
      deviceFingerprint,
    };
  } catch (error) {
    if (isSchemaMismatch(error)) {
      return null;
    }
    throw error;
  }
}

export async function touchSession(sessionId: string, companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { sessionPolicy: true },
  });
  const policy = parseSessionPolicy(company?.sessionPolicy);
  const idleMinutes = parseMinutes(policy.idleTimeoutMinutes);

  await prisma.iamSession.update({
    where: { id: sessionId },
    data: {
      lastSeenAt: new Date(),
      idleExpiresAt: new Date(Date.now() + idleMinutes * 60 * 1000),
    },
  });
}

export async function rotateSession(oldToken: string): Promise<{ token: string; expiresAt: Date } | null> {
  const oldHash = hashToken(oldToken);
  const existing = await prisma.iamSession.findUnique({
    where: { sessionTokenHash: oldHash },
    select: {
      id: true,
      userId: true,
      companyId: true,
      rememberMe: true,
      ip: true,
      userAgent: true,
      requestId: true,
      revokedAt: true,
      expiresAt: true,
      idleExpiresAt: true,
    },
  });

  if (!existing) return null;
  if (existing.revokedAt) return null;
  if (existing.expiresAt <= new Date()) return null;

  await prisma.iamSession.update({ where: { id: existing.id }, data: { revokedAt: new Date(), revokeReason: "SECURITY_EVENT" } });

  const next = await createSessionRecord({
    userId: existing.userId,
    companyId: existing.companyId,
    rememberMe: existing.rememberMe,
    ip: existing.ip,
    userAgent: existing.userAgent,
    requestId: existing.requestId,
  });

  return { token: next.token, expiresAt: next.expiresAt };
}

export async function revokeSessionById(sessionId: string, reason: "USER_LOGOUT" | "USER_REVOKE_ALL" | "ADMIN_REVOKE" | "SECURITY_EVENT") {
  await prisma.iamSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}

export async function revokeAllSessionsForUser(userId: string, reason: "USER_LOGOUT" | "USER_REVOKE_ALL" | "ADMIN_REVOKE" | "SECURITY_EVENT") {
  await prisma.iamSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}

export async function listSessionsForUser(userId: string) {
  return prisma.iamSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      ip: true,
      userAgent: true,
      companyId: true,
    },
  });
}

export const iamSessionCookieName = COOKIE_NAME;
