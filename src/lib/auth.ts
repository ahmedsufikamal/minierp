import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

function isIamV2Enabled(): boolean {
  return process.env.IAM_V2_ENABLED === "1";
}

function isSchemaMismatch(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function getCompanyIdOrUserId() {
  const session = await verifySession();
  if (!session) {
    redirect("/auth/sign-in");
  }
  return session.companyId || session.userId;
}

// Backwards compatibility for existing modules; prefer getCompanyIdOrUserId
export const getOrgIdOrUserId = getCompanyIdOrUserId;

export async function getUser() {
  const session = await verifySession();
  return session;
}

export async function getCurrentUser() {
  const session = await verifySession();
  if (!session?.userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        platformRole: true,
        activeCompanyId: true,
        status: true,
        avatarUrl: true,
        phone: true,
        uiThemePreference: true,
        mustResetPassword: true,
      },
    });
    if (!user) return null;
    return {
      ...user,
      isImpersonating: Boolean(session.isImpersonating),
      impersonatorUserId: session.impersonatorUserId ?? null,
      impersonationExpiresAt: session.impersonationExpiresAt ?? null,
      deviceFingerprint: session.deviceFingerprint ?? null,
    };
  } catch (error) {
    if (isSchemaMismatch(error)) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          companyId: true,
          avatarUrl: true,
          phone: true,
        },
      });

      if (!user) return null;

      return {
        ...user,
        platformRole: "NONE" as const,
        activeCompanyId: isIamV2Enabled() ? (session.companyId ?? user.companyId) : user.companyId,
        status: "ACTIVE" as const,
        uiThemePreference: "SYSTEM" as const,
        mustResetPassword: false,
        isImpersonating: Boolean(session.isImpersonating),
        impersonatorUserId: session.impersonatorUserId ?? null,
        impersonationExpiresAt: session.impersonationExpiresAt ?? null,
        deviceFingerprint: session.deviceFingerprint ?? null,
      };
    }

    throw error;
  }
}

const LEGACY_ADMIN_PERMISSIONS = new Set(["settings:write", "audit:read", "user:manage"]);
const LEGACY_USER_PERMISSIONS = new Set([
  "customer:*", "vendor:*", "product:*", "invoice:*", "bill:*",
  "quote:*", "purchase-order:*", "payment:*", "inventory:*", "accounting:*",
]);

const legacyToIamPermissionMap: Record<string, string> = {
  "settings:write": "admin.settings",
  "audit:read": "iam.audit.read",
  "user:manage": "admin.members",
  "inventory:read": "inventory.read",
  "inventory:write": "inventory.write",
};

const iamRolePermissionDefaults: Record<string, Set<string>> = {
  OWNER: new Set(Object.values(legacyToIamPermissionMap)),
  ADMIN: new Set(Object.values(legacyToIamPermissionMap)),
  MANAGER: new Set(["inventory.read", "inventory.write"]),
  MEMBER: new Set(["inventory.read"]),
  VIEWER: new Set(["inventory.read"]),
  AUDITOR: new Set(["inventory.read", "iam.audit.read"]),
};

export type ServerActionPermissionSpec = {
  iamPermission: string;
  legacyPermission: string;
};

export type ServerActionPermissionContext = {
  userId: string;
  companyId: string;
  role: string;
  permissions: string[];
};

export type ServerActionPermissionResult = {
  allowed: boolean;
  context: ServerActionPermissionContext | null;
};

export function hasServerActionPermission(input: {
  role: string;
  permissions?: string[] | null;
  iamPermission: string;
  legacyPermission: string;
  iamV2Enabled?: boolean;
}): boolean {
  const iamEnabled = input.iamV2Enabled ?? isIamV2Enabled();
  const granted = Array.isArray(input.permissions) ? input.permissions : [];

  // IAM v2 first: require exact permission match when session permissions are present.
  if (iamEnabled && granted.length > 0) {
    return granted.includes(input.iamPermission);
  }

  // Compatibility fallback: legacy role + permission map.
  return can(input.role, input.legacyPermission);
}

export async function authorizeServerActionPermission(
  spec: ServerActionPermissionSpec,
): Promise<ServerActionPermissionResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { allowed: false, context: null };
  }

  const context: ServerActionPermissionContext = {
    userId: session.userId,
    companyId: session.companyId || session.userId,
    role: session.role ?? "",
    permissions: Array.isArray(session.permissions) ? session.permissions : [],
  };

  const allowed = hasServerActionPermission({
    role: context.role,
    permissions: context.permissions,
    iamPermission: spec.iamPermission,
    legacyPermission: spec.legacyPermission,
  });

  return { allowed, context };
}

export function can(role: string, permission: string): boolean {
  if (process.env.IAM_V2_ENABLED === "1") {
    const mapped = legacyToIamPermissionMap[permission];
    if (mapped) {
      const set = iamRolePermissionDefaults[role] ?? new Set<string>();
      return set.has(mapped);
    }
  }

  if (role === "ADMIN") return true;
  if (LEGACY_ADMIN_PERMISSIONS.has(permission)) return role === "ADMIN";
  const [resource] = permission.split(":");
  return LEGACY_USER_PERMISSIONS.has(permission) || LEGACY_USER_PERMISSIONS.has(`${resource}:*`);
}
