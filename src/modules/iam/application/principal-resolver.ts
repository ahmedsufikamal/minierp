import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSessionToken, type SessionPayload } from "@/lib/legacy-session-token";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import { getPermissionsForUserCompany } from "@/modules/iam/application/rbac";
import { verifySessionToken } from "@/modules/iam/infrastructure/session";

export type PrincipalSource = "iam" | "legacy";

export interface PrincipalResolution {
  principal: IamPrincipal | null;
  source: PrincipalSource | null;
  legacyPayload: SessionPayload | null;
}

export interface ResolvePrincipalOptions {
  allowLegacyFallback?: boolean;
}

export interface PrincipalResolverDependencies {
  verifyIamSessionToken: (token: string) => Promise<IamPrincipal | null>;
  decryptLegacySession: (token: string | undefined) => Promise<SessionPayload | null>;
  loadLegacyPrincipal: (payload: SessionPayload) => Promise<IamPrincipal | null>;
}

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export function isLegacyFallbackEnabled(): boolean {
  const explicit = process.env.IAM_LEGACY_FALLBACK_ENABLED;
  if (explicit === "1") return true;
  if (explicit === "0") return false;
  return true;
}

export async function buildLegacyPrincipalFromSession(payload: SessionPayload): Promise<IamPrincipal | null> {
  let user:
    | {
        id: string;
        email: string;
        name: string;
        platformRole: "SUPER_ADMIN" | "SUPPORT" | "NONE";
        status: string;
        role: string;
        companyId: string;
        activeCompanyId: string | null;
      }
    | null;

  try {
    user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        status: true,
        role: true,
        companyId: true,
        activeCompanyId: true,
      },
    });
  } catch (error) {
    if (!isSchemaMismatch(error)) {
      throw error;
    }

    const legacyUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });

    user = legacyUser
      ? {
          ...legacyUser,
          platformRole: "NONE",
          status: "ACTIVE",
          activeCompanyId: legacyUser.companyId,
        }
      : null;
  }

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  const candidateCompanyIds = [payload.companyId, user.activeCompanyId, user.companyId].filter(
    (value): value is string => Boolean(value),
  );

  try {
    const membership =
      (candidateCompanyIds.length > 0
        ? await prisma.companyMembership.findFirst({
            where: {
              userId: user.id,
              status: "ACTIVE",
              companyId: { in: candidateCompanyIds },
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            select: { companyId: true, role: true },
          })
        : null) ??
      (await prisma.companyMembership.findFirst({
        where: {
          userId: user.id,
          status: "ACTIVE",
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { companyId: true, role: true },
      }));

    if (!membership) {
      return null;
    }

    const permissions = await getPermissionsForUserCompany(user.id, membership.companyId);

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
      activeCompanyId: membership.companyId,
      membershipRole: membership.role,
      permissions,
      sessionId: `legacy:${payload.userId}`,
      stepUpVerifiedAt: null,
      mfaRequired: false,
    };
  } catch (error) {
    if (!isSchemaMismatch(error)) {
      throw error;
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
      activeCompanyId: payload.companyId ?? user.activeCompanyId ?? user.companyId,
      membershipRole: user.role,
      permissions: [],
      sessionId: `legacy:${payload.userId}`,
      stepUpVerifiedAt: null,
      mfaRequired: false,
    };
  }
}

const defaultDependencies: PrincipalResolverDependencies = {
  verifyIamSessionToken: verifySessionToken,
  decryptLegacySession: decryptSessionToken,
  loadLegacyPrincipal: buildLegacyPrincipalFromSession,
};

export async function resolvePrincipalFromTokens(
  input: {
    iamSessionToken?: string | null;
    legacySessionToken?: string | null;
  },
  options: ResolvePrincipalOptions = {},
  dependencies: PrincipalResolverDependencies = defaultDependencies,
): Promise<PrincipalResolution> {
  if (input.iamSessionToken) {
    const iamPrincipal = await dependencies.verifyIamSessionToken(input.iamSessionToken);
    if (iamPrincipal) {
      return {
        principal: iamPrincipal,
        source: "iam",
        legacyPayload: null,
      };
    }
  }

  const allowLegacyFallback = options.allowLegacyFallback ?? isLegacyFallbackEnabled();
  if (!allowLegacyFallback || !input.legacySessionToken) {
    return {
      principal: null,
      source: null,
      legacyPayload: null,
    };
  }

  const payload = await dependencies.decryptLegacySession(input.legacySessionToken);
  if (!payload?.userId) {
    return {
      principal: null,
      source: null,
      legacyPayload: null,
    };
  }

  const legacyPrincipal = await dependencies.loadLegacyPrincipal(payload);
  if (!legacyPrincipal) {
    return {
      principal: null,
      source: null,
      legacyPayload: payload,
    };
  }

  return {
    principal: legacyPrincipal,
    source: "legacy",
    legacyPayload: payload,
  };
}

export async function resolvePrincipalFromCookies(options: ResolvePrincipalOptions = {}): Promise<PrincipalResolution> {
  const cookieStore = await cookies();
  return resolvePrincipalFromTokens(
    {
      iamSessionToken: cookieStore.get("iam_session")?.value ?? null,
      legacySessionToken: cookieStore.get("session")?.value ?? null,
    },
    options,
  );
}
