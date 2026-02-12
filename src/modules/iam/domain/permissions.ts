export const permissionCatalog = {
  "inventory.read": { module: "inventory", description: "Read inventory entities" },
  "inventory.write": { module: "inventory", description: "Create/update inventory entities" },
  "inventory.approve": { module: "inventory", description: "Approve inventory documents" },
  "sales.read": { module: "sales", description: "Read sales data" },
  "sales.write": { module: "sales", description: "Create/update sales data" },
  "finance.read": { module: "finance", description: "Read financial data" },
  "finance.write": { module: "finance", description: "Create/update financial data" },
  "admin.members": { module: "admin", description: "Manage tenant members" },
  "admin.roles": { module: "admin", description: "Manage tenant roles" },
  "admin.settings": { module: "admin", description: "Manage tenant settings/policies" },
  "iam.audit.read": { module: "iam", description: "Read IAM audit logs" },
  "iam.sessions.revoke": { module: "iam", description: "Revoke user sessions" },
  "iam.impersonate": { module: "iam", description: "Impersonate user sessions" },
} as const;

export type PermissionKey = keyof typeof permissionCatalog;

export const defaultRolePermissions: Record<string, PermissionKey[]> = {
  OWNER: Object.keys(permissionCatalog) as PermissionKey[],
  ADMIN: [
    "inventory.read",
    "inventory.write",
    "inventory.approve",
    "sales.read",
    "sales.write",
    "finance.read",
    "finance.write",
    "admin.members",
    "admin.roles",
    "admin.settings",
    "iam.audit.read",
    "iam.sessions.revoke",
  ],
  MANAGER: [
    "inventory.read",
    "inventory.write",
    "sales.read",
    "sales.write",
    "finance.read",
  ],
  MEMBER: ["inventory.read", "sales.read", "finance.read"],
  VIEWER: ["inventory.read", "sales.read", "finance.read"],
  AUDITOR: ["inventory.read", "sales.read", "finance.read", "iam.audit.read"],
};

export const defaultRoleDescriptions: Record<string, string> = {
  OWNER: "Tenant owner with unrestricted access",
  ADMIN: "Tenant administrator",
  MANAGER: "Operational manager",
  MEMBER: "Regular member",
  VIEWER: "Read-only access",
  AUDITOR: "Read-only + audit visibility",
};
