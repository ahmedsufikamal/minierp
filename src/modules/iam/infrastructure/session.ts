import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionCookieDomain } from "@/lib/runtime-env";
import { hashToken, randomToken } from "@/modules/iam/infrastructure/crypto";
import { parseMfaPolicy, parseSessionPolicy } from "@/modules/iam/application/policy";
import { getPermissionsForUserCompany } from "@/modules/iam/application/rbac";
import type { IamPrincipal } from "@/modules/iam/domain/types";

const COOKIE_NAME = "iam_session";

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
  const cookieStore = await cookies();
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
  const cookieStore = await cookies();
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
  const sessionTokenHash = hashToken(sessionToken);
  const now = new Date();

  const session = await prisma.iamSession.findUnique({
    where: { sessionTokenHash },
    select: {
      id: true,
      userId: true,
      companyId: true,
      stepUpVerifiedAt: true,
      revokedAt: true,
      idleExpiresAt: true,
      expiresAt: true,
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
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt <= now) return null;
  if (session.idleExpiresAt <= now) return null;

  const membership = await prisma.companyMembership.findUnique({
    where: { userId_companyId: { userId: session.userId, companyId: session.companyId } },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") return null;
  const mfaPolicy = parseMfaPolicy(session.company?.mfaPolicy);
  const mfaRequiredByPolicy =
    mfaPolicy.mode === "REQUIRED_FOR_ALL" ||
    (mfaPolicy.mode === "REQUIRED_FOR_ADMINS" && ["OWNER", "ADMIN"].includes(membership.role));
  const mfaRequired = mfaRequiredByPolicy && !session.stepUpVerifiedAt;

  const permissions = await getPermissionsForUserCompany(session.userId, session.companyId);

  return {
    userId: session.userId,
    email: session.user.email,
    name: session.user.name,
    platformRole: session.user.platformRole,
    activeCompanyId: session.companyId,
    membershipRole: membership.role,
    permissions,
    sessionId: session.id,
    stepUpVerifiedAt: session.stepUpVerifiedAt,
    mfaRequired,
  };
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
