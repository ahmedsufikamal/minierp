import type { IamPrincipal, TenantTheme } from "@/modules/iam/domain/types";
import type { PermissionKey } from "@/modules/iam/domain/permissions";

export interface IdentityProviderAdapter {
  signUp(input: {
    email: string;
    password: string;
    name: string;
    companyName?: string;
    companySlug?: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<{ sessionId: string }>;
  signIn(input: {
    email: string;
    password?: string;
    companyIdHint?: string;
    ip?: string | null;
    userAgent?: string | null;
    rememberMe?: boolean;
  }): Promise<{ sessionId: string; mfaRequired?: boolean }>;
  verifySession(sessionToken: string | null | undefined): Promise<IamPrincipal | null>;
  rotateSession(sessionToken: string): Promise<string>;
  revokeSession(sessionId: string, actorUserId?: string): Promise<void>;
  revokeAllSessionsForUser(userId: string, actorUserId?: string): Promise<void>;
  listUserSessions(userId: string): Promise<Array<{ id: string; createdAt: Date; lastSeenAt: Date; ip?: string | null; userAgent?: string | null }>>;

  sendMagicLink(input: { email: string; redirectTo?: string; ip?: string | null }): Promise<void>;
  verifyMagicLink(input: { token: string; ip?: string | null; userAgent?: string | null }): Promise<{ sessionId: string }>;

  sendOtp(input: { destination: string; channel: "EMAIL" | "SMS"; purpose: string; userId?: string; companyId?: string; ip?: string | null }): Promise<void>;
  verifyOtp(input: { destination: string; code: string; purpose: string }): Promise<{ ok: true }>;

  enrollMfa(input: { userId: string; label?: string }): Promise<{ secret: string; otpauthUri: string; recoveryCodes: string[] }>;
  verifyMfa(input: { userId: string; code: string }): Promise<{ ok: true }>;

  resolveTenantTheme(input: { host?: string | null; companyId?: string | null }): Promise<TenantTheme | null>;

  listOrgMembers(companyId: string): Promise<Array<{ userId: string; email: string; name: string; role: string; status: string }>>;
  inviteToOrg(input: {
    companyId: string;
    email: string;
    roleId?: string | null;
    createdByUserId: string;
    autoJoinRuleId?: string | null;
  }): Promise<{ invitationId: string }>;
  acceptInvite(input: { token: string; userId: string }): Promise<void>;

  setRole(input: { companyId: string; userId: string; roleId: string }): Promise<void>;
  checkPermission(input: { userId: string; companyId: string; permission: PermissionKey }): Promise<boolean>;
}
