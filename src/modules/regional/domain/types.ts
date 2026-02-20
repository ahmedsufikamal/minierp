export const regionalPermissions = {
  profileRead: "regional.profile.read",
  profileWrite: "regional.profile.write",
  profileManage: "regional.profile.manage",
} as const;

export type RegionalPermission = (typeof regionalPermissions)[keyof typeof regionalPermissions];
