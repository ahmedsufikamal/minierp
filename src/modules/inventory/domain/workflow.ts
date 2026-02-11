import { z } from "zod";

export const workflowTransitionSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "CANCEL", "POST"]),
  from: z.array(z.string()).min(1),
  to: z.string().min(1),
  requiredPermissions: z.array(z.string()).default([]),
  minApprovals: z.number().int().positive().default(1),
  thresholdAmountMinor: z.number().int().nonnegative().optional(),
});

export const workflowConfigSchema = z.object({
  initialStatus: z.string().default("DRAFT"),
  terminalStatuses: z.array(z.string()).default(["POSTED", "CANCELLED", "REJECTED"]),
  transitions: z.array(workflowTransitionSchema).min(1),
});

export type WorkflowConfig = z.infer<typeof workflowConfigSchema>;
export type WorkflowTransition = z.infer<typeof workflowTransitionSchema>;

export function defaultWorkflowConfig(): WorkflowConfig {
  return {
    initialStatus: "DRAFT",
    terminalStatuses: ["POSTED", "CANCELLED", "REJECTED"],
    transitions: [
      { action: "SUBMIT", from: ["DRAFT"], to: "SUBMITTED", requiredPermissions: ["inventory.document.write"], minApprovals: 1 },
      { action: "APPROVE", from: ["SUBMITTED"], to: "APPROVED", requiredPermissions: ["inventory.document.approve"], minApprovals: 1 },
      { action: "REJECT", from: ["SUBMITTED"], to: "REJECTED", requiredPermissions: ["inventory.document.approve"], minApprovals: 1 },
      { action: "CANCEL", from: ["DRAFT", "SUBMITTED", "APPROVED"], to: "CANCELLED", requiredPermissions: ["inventory.document.write"], minApprovals: 1 },
      { action: "POST", from: ["APPROVED"], to: "POSTED", requiredPermissions: ["inventory.document.post"], minApprovals: 1 },
    ],
  };
}

export function findTransition(config: WorkflowConfig, action: string, currentStatus: string, totalValueMinor = 0) {
  const match = config.transitions.find((transition) => {
    if (transition.action !== action) return false;
    if (!transition.from.includes(currentStatus)) return false;
    if (transition.thresholdAmountMinor == null) return true;
    return totalValueMinor >= transition.thresholdAmountMinor;
  });
  return match ?? null;
}
