export const ediPermissions = {
  codeRead: "edi.code.read",
  codeWrite: "edi.code.write",
  transportRead: "edi.transport.read",
  transportWrite: "edi.transport.write",
  transportManage: "edi.transport.manage",
} as const;

export type EdiPermission = (typeof ediPermissions)[keyof typeof ediPermissions];
