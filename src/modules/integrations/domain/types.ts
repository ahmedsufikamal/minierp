export const integrationsPermissions = {
  templateRead: "integrations.template.read",
  templateWrite: "integrations.template.write",
  emailQueueRead: "integrations.email-queue.read",
  emailQueueWrite: "integrations.email-queue.write",
  tokenRead: "integrations.token.read",
  tokenWrite: "integrations.token.write",
  tokenManage: "integrations.token.manage",
} as const;

export type IntegrationsPermission =
  (typeof integrationsPermissions)[keyof typeof integrationsPermissions];
