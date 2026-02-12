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
      },
    });
    return user;
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
        },
      });

      if (!user) return null;

      return {
        ...user,
        platformRole: "NONE" as const,
        activeCompanyId: isIamV2Enabled() ? (session.companyId ?? user.companyId) : user.companyId,
        status: "ACTIVE" as const,
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
