"use client";

import type { RecordTab } from "@/components/records/record-layout";

export const lcRecordTabs: RecordTab[] = [
  { value: "details", label: "Details" },
  { value: "amendments", label: "Amendments" },
  { value: "documents", label: "Documents" },
  { value: "discrepancies", label: "Discrepancies" },
  { value: "charges-payments", label: "Charges & Payments" },
  { value: "timeline", label: "Timeline" },
];
