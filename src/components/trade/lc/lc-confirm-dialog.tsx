"use client";

import type { ComponentProps } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function LCConfirmDialog(props: ComponentProps<typeof ConfirmDialog>) {
  return <ConfirmDialog {...props} />;
}
