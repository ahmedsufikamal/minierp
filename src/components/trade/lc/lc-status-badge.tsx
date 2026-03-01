"use client";

import { Badge } from "@/components/ui/badge";

const variantByStatus: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  REQUESTED: "outline",
  APPROVED: "outline",
  ISSUED: "default",
  ACTIVE: "default",
  DOCS_RECEIVED: "outline",
  UNDER_SCRUTINY: "outline",
  DISCREPANT: "destructive",
  ACCEPTED: "default",
  SETTLED: "default",
  CLOSED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "destructive",
};

export function LCStatusBadge({ status }: { status: string }) {
  return <Badge variant={variantByStatus[status] ?? "outline"}>{status.replaceAll("_", " ")}</Badge>;
}
