export const manufacturingPermissions = {
  bomRead: "manufacturing.bom.read",
  bomWrite: "manufacturing.bom.write",
  bomApprove: "manufacturing.bom.approve",
  routingRead: "manufacturing.routing.read",
  routingWrite: "manufacturing.routing.write",
  workOrderRead: "manufacturing.work-order.read",
  workOrderWrite: "manufacturing.work-order.write",
  workOrderRelease: "manufacturing.work-order.release",
  jobCardRead: "manufacturing.job-card.read",
  jobCardWrite: "manufacturing.job-card.write",
  jobCardComplete: "manufacturing.job-card.complete",
} as const;

export type ManufacturingPermission = (typeof manufacturingPermissions)[keyof typeof manufacturingPermissions];
