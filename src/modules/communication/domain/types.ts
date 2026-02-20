export const communicationPermissions = {
  windowRead: "communication.window.read",
  windowWrite: "communication.window.write",
  logRead: "communication.log.read",
  logWrite: "communication.log.write",
} as const;

export type CommunicationPermission = (typeof communicationPermissions)[keyof typeof communicationPermissions];
