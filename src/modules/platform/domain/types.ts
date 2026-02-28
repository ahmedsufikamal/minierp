export const platformPermissions = {
  tenantsRead: "platform.tenants.read",
  tenantsWrite: "platform.tenants.write",
  rbacRead: "platform.rbac.read",
  rbacWrite: "platform.rbac.write",
  workflowRead: "platform.workflow.read",
  workflowWrite: "platform.workflow.write",
  auditRead: "platform.audit.read",
  ledgerRead: "platform.ledger.read",
  numberingRead: "platform.numbering.read",
  numberingWrite: "platform.numbering.write",
  reportingRead: "platform.reporting.read",
  reportingWrite: "platform.reporting.write",
  customizationRead: "platform.customization.read",
  customizationWrite: "platform.customization.write",
  metaRead: "meta.read",
  metaReadDrafts: "meta.read_drafts",
  metaWrite: "meta.write",
  metaPublish: "meta.publish",
  masterRead: "master.read",
  masterWrite: "master.write",
} as const;

export type PlatformPermission = (typeof platformPermissions)[keyof typeof platformPermissions];

export type PlatformRequestContext = {
  requestId: string;
  tenantId: string;
  companyId: string;
  userId: string;
  role: string;
  platformRole: "SUPER_ADMIN" | "SUPPORT" | "NONE";
  permissions: string[];
  responseHeaders?: Record<string, string>;
  ipAddress?: string;
  userAgent?: string;
};

export type RowScopeInput = {
  tenantId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  warehouseId?: string | null;
  projectId?: string | null;
};

export type NumberSeriesAllocationInput = {
  key: string;
  companyId?: string | null;
  date?: Date;
  fiscalYear?: string;
  strictCompanyScope?: boolean;
};
