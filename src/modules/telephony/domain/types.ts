export const telephonyPermissions = {
  callRead: "telephony.call.read",
  callWrite: "telephony.call.write",
  callManage: "telephony.call.manage",
} as const;

export type TelephonyPermission = (typeof telephonyPermissions)[keyof typeof telephonyPermissions];
