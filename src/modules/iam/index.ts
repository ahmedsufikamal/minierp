export type { TenantContext, IamPrincipal, PlatformRole, TenantTheme } from "@/modules/iam/domain/types";
export type { PermissionKey } from "@/modules/iam/domain/permissions";
export type { IamErrorCode } from "@/modules/iam/domain/errors";

export { permissionCatalog, defaultRolePermissions, defaultRoleDescriptions } from "@/modules/iam/domain/permissions";
export { IamError, isIamError } from "@/modules/iam/domain/errors";
export { getIdentityProvider } from "@/modules/iam/infrastructure/provider";
export { resolveTenantThemeByRequest, themeToCssVars } from "@/modules/iam/infrastructure/theme";
export {
  requireAuth,
  requireTenantMembership,
  requirePermission,
  requirePlatformAdmin,
  requireStepUp,
  canUI,
  setActiveCompany,
} from "@/modules/iam/application/guards";
