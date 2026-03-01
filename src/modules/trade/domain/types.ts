import type { PlatformRequestContext } from "@/modules/platform/domain/types";

export const tradePermissions = {
  lcRead: "trade.lc.read",
  lcWrite: "trade.lc.write",
  lcApprove: "trade.lc.approve",
  lcIssue: "trade.lc.issue",
  lcSettle: "trade.lc.settle",
  lcAdmin: "trade.lc.admin",
} as const;

export type TradePermission = (typeof tradePermissions)[keyof typeof tradePermissions];

export const tradePermissionAliases: Record<TradePermission, readonly string[]> = {
  "trade.lc.read": ["finance.read", "accounting.report.read"],
  "trade.lc.write": ["finance.write"],
  "trade.lc.approve": ["finance.write"],
  "trade.lc.issue": ["finance.write"],
  "trade.lc.settle": ["finance.write"],
  "trade.lc.admin": ["admin.settings"],
};

type PermissionCarrier = Pick<PlatformRequestContext, "platformRole" | "permissions">;

export function hasTradePermission(ctx: PermissionCarrier, permission: TradePermission): boolean {
  if (ctx.platformRole === "SUPER_ADMIN") return true;
  if (ctx.permissions.includes(permission)) return true;
  return (tradePermissionAliases[permission] ?? []).some((alias) => ctx.permissions.includes(alias));
}

export const tradeLcOpenStatuses = [
  "DRAFT",
  "REQUESTED",
  "APPROVED",
  "ISSUED",
  "ACTIVE",
  "DOCS_RECEIVED",
  "UNDER_SCRUTINY",
  "DISCREPANT",
  "ACCEPTED",
  "SETTLED",
] as const;

export const tradeLcTerminalStatuses = ["CLOSED", "CANCELLED", "EXPIRED"] as const;

export const tradeLcPostIssueStatuses = [
  "ISSUED",
  "ACTIVE",
  "DOCS_RECEIVED",
  "UNDER_SCRUTINY",
  "DISCREPANT",
  "ACCEPTED",
  "SETTLED",
] as const;

export type TradeLcWorkflowAction = "SUBMIT" | "APPROVE" | "ISSUE" | "CANCEL" | "CLOSE";
