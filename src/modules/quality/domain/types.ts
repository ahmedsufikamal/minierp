export const qualityPermissions = {
  inspectionRead: "quality.inspection.read",
  inspectionWrite: "quality.inspection.write",
  inspectionApprove: "quality.inspection.approve",
  capaRead: "quality.capa.read",
  capaWrite: "quality.capa.write",
  capaClose: "quality.capa.close",
  goalRead: "quality.goal.read",
  goalWrite: "quality.goal.write",
  goalManage: "quality.goal.manage",
} as const;

export type QualityPermission = (typeof qualityPermissions)[keyof typeof qualityPermissions];
