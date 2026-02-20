export const assetsPermissions = {
  categoryRead: "assets.category.read",
  categoryWrite: "assets.category.write",
  assetRead: "assets.asset.read",
  assetWrite: "assets.asset.write",
  assetPost: "assets.asset.post",
} as const;

export type AssetsPermission = (typeof assetsPermissions)[keyof typeof assetsPermissions];
