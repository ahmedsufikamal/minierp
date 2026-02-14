function readBooleanFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === "1") return true;
  if (value === "0") return false;
  return fallback;
}

export function isMasterAdminEnforcementEnabled(): boolean {
  return readBooleanFlag("IAM_MASTER_ADMIN_ENFORCEMENT", true);
}

export function isPlatformRoleManagementEnabled(): boolean {
  return readBooleanFlag("IAM_PLATFORM_ROLE_MANAGEMENT", true);
}

export function isSelfServeOrgCreationEnabled(): boolean {
  return readBooleanFlag("IAM_SELF_SERVE_ORG_CREATION", true);
}
