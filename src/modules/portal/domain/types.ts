export const portalPermissions = {
  configRead: "portal.config.read",
  configWrite: "portal.config.write",
  configManage: "portal.config.manage",
} as const;

export type PortalPermission = (typeof portalPermissions)[keyof typeof portalPermissions];
