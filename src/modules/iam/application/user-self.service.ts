import { prisma } from "@/lib/prisma";
import type { IamPrincipal } from "@/modules/iam/domain/types";
import { IamError } from "@/modules/iam/domain/errors";
import { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
import { writeIamAudit } from "@/modules/iam/infrastructure/audit";

export type SelfProfileDto = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  uiThemePreference: "LIGHT" | "DARK" | "SYSTEM";
  status: string;
};

export type SessionDto = {
  id: string;
  maskedId: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

export function maskSessionId(sessionId: string): string {
  if (!sessionId) return "hidden";
  if (sessionId.length <= 8) return `${sessionId.slice(0, 2)}••••`;
  return `${sessionId.slice(0, 4)}••••${sessionId.slice(-4)}`;
}

export async function getCurrentUserProfile(principal: IamPrincipal): Promise<SelfProfileDto> {
  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      uiThemePreference: true,
      status: true,
    },
  });

  if (!user) {
    throw new IamError("NOT_FOUND", "User not found");
  }

  return user;
}

export async function listCurrentUserSessions(principal: IamPrincipal): Promise<{ sessions: SessionDto[] }> {
  const sessions = await getIdentityProvider().listUserSessions(principal.userId);

  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      maskedId: maskSessionId(session.id),
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      ip: session.ip ?? null,
      userAgent: session.userAgent ?? null,
      isCurrent: session.id === principal.sessionId,
    })),
  };
}

export async function revokeCurrentUserSession(principal: IamPrincipal, sessionId: string): Promise<void> {
  await getIdentityProvider().revokeSession(sessionId, principal.userId);
  await writeIamAudit({
    action: "SESSION_REVOKED",
    companyId: principal.activeCompanyId,
    actorUserId: principal.userId,
    entityType: "IamSession",
    entityId: sessionId,
    metadata: { selfService: true },
  });
}
