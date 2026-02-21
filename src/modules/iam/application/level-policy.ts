import { IamError } from "@/modules/iam/domain/errors";
import type { PlatformRole, UserTypeLabel, UserTypeLevel } from "@/modules/iam/domain/types";

export type AuthzAction = "read" | "create" | "update" | "delete" | "submit_approve" | "export" | "manage";

export const USER_TYPE_LEVEL = {
  SUPPORT_USER: 2,
  GENERAL_USER: 3,
  ADMINISTRATOR_USER: 4,
  MASTER_USER: 5,
  SUPER_USER: 9,
} as const;

const VALID_LEVELS = new Set<UserTypeLevel>([2, 3, 4, 5, 9]);
const ADMIN_LEVEL_THRESHOLD: UserTypeLevel = 4;

export function isValidUserTypeLevel(value: unknown): value is UserTypeLevel {
  return typeof value === "number" && VALID_LEVELS.has(value as UserTypeLevel);
}

export function normalizeUserTypeLevel(value: unknown, fallback: UserTypeLevel = USER_TYPE_LEVEL.GENERAL_USER): UserTypeLevel {
  return isValidUserTypeLevel(value) ? value : fallback;
}

export function getUserTypeLabelForLevel(level: UserTypeLevel): UserTypeLabel {
  switch (level) {
    case USER_TYPE_LEVEL.SUPER_USER:
      return "SUPER_USER";
    case USER_TYPE_LEVEL.MASTER_USER:
      return "MASTER_USER";
    case USER_TYPE_LEVEL.ADMINISTRATOR_USER:
      return "ADMINISTRATOR_USER";
    case USER_TYPE_LEVEL.SUPPORT_USER:
      return "SUPPORT_USER";
    case USER_TYPE_LEVEL.GENERAL_USER:
    default:
      return "GENERAL_USER";
  }
}

export function mapRoleToUserTypeLevel(role: string): UserTypeLevel {
  switch ((role || "").toUpperCase()) {
    case "OWNER":
    case "COMPANY_OWNER":
    case "MASTER_ADMIN":
      return USER_TYPE_LEVEL.MASTER_USER;
    case "ADMIN":
    case "COMPANY_ADMIN":
      return USER_TYPE_LEVEL.ADMINISTRATOR_USER;
    case "SUPPORT":
      return USER_TYPE_LEVEL.SUPPORT_USER;
    case "SUPER_ADMIN":
      return USER_TYPE_LEVEL.SUPER_USER;
    default:
      return USER_TYPE_LEVEL.GENERAL_USER;
  }
}

export function resolveEffectiveUserTypeLevel(input: {
  platformRole: PlatformRole;
  membershipRole: string;
  membershipLevel: unknown;
}): UserTypeLevel {
  if (input.platformRole === "SUPER_ADMIN") {
    return USER_TYPE_LEVEL.SUPER_USER;
  }
  if (input.platformRole === "SUPPORT" && !isValidUserTypeLevel(input.membershipLevel)) {
    return USER_TYPE_LEVEL.SUPPORT_USER;
  }
  return normalizeUserTypeLevel(input.membershipLevel, mapRoleToUserTypeLevel(input.membershipRole));
}

export function permissionToModuleAction(permission: string): { module: string; action: AuthzAction } {
  if (!permission.includes(".")) {
    return { module: permission, action: "manage" };
  }

  const parts = permission.split(".");
  const moduleName = parts[0] ?? "general";
  const tail = parts[parts.length - 1] ?? "";

  if (tail === "read") return { module: moduleName, action: "read" };
  if (tail === "write") return { module: moduleName, action: "update" };
  if (tail === "delete") return { module: moduleName, action: "delete" };
  if (tail === "approve" || tail === "submit" || tail === "post") return { module: moduleName, action: "submit_approve" };
  if (tail === "export") return { module: moduleName, action: "export" };

  if (permission.startsWith("admin.") || permission.startsWith("iam.") || permission.startsWith("platform.")) {
    return { module: moduleName, action: "manage" };
  }

  return { module: moduleName, action: "manage" };
}

export function isLevelAllowedForAction(level: UserTypeLevel, moduleName: string, action: AuthzAction): boolean {
  if (level === USER_TYPE_LEVEL.SUPER_USER || level === USER_TYPE_LEVEL.MASTER_USER) {
    return true;
  }

  if (level === USER_TYPE_LEVEL.ADMINISTRATOR_USER) {
    return true;
  }

  if (level === USER_TYPE_LEVEL.GENERAL_USER) {
    return action !== "manage";
  }

  // SUPPORT user: support-module write operations + read-only for other modules.
  if (action === "read") return true;
  if (moduleName === "support" && (action === "create" || action === "update" || action === "delete")) {
    return true;
  }
  return false;
}

export function assertPermissionAllowedByLevel(level: UserTypeLevel, permission: string): void {
  if (level >= ADMIN_LEVEL_THRESHOLD) return;
  const { module: moduleName, action } = permissionToModuleAction(permission);
  if (!isLevelAllowedForAction(level, moduleName, action)) {
    throw new IamError("FORBIDDEN", `Level ${level} cannot perform ${action} in module ${moduleName}`);
  }
}

export function canManageTargetLevel(actorLevel: UserTypeLevel, targetLevel: UserTypeLevel): boolean {
  if (actorLevel === USER_TYPE_LEVEL.SUPER_USER) return true;
  if (actorLevel === USER_TYPE_LEVEL.MASTER_USER) return targetLevel < USER_TYPE_LEVEL.MASTER_USER;
  if (actorLevel === USER_TYPE_LEVEL.ADMINISTRATOR_USER) {
    return targetLevel <= USER_TYPE_LEVEL.GENERAL_USER;
  }
  return false;
}

export function assertCanManageTargetLevel(actorLevel: UserTypeLevel, targetLevel: UserTypeLevel): void {
  if (!canManageTargetLevel(actorLevel, targetLevel)) {
    throw new IamError("FORBIDDEN", `Level ${actorLevel} cannot manage level ${targetLevel}`);
  }
}

export function isOrgAdminOrHigher(level: UserTypeLevel): boolean {
  return level >= ADMIN_LEVEL_THRESHOLD;
}
