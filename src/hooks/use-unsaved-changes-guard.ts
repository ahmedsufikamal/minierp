"use client";

import { useEffect } from "react";

type UseUnsavedChangesGuardOptions = {
  enabled: boolean;
  message?: string;
};

export function useUnsavedChangesGuard({
  enabled,
  message = "You have unsaved changes. Leave without saving?",
}: UseUnsavedChangesGuardOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return;
      }

      if (!window.confirm(message)) {
        event.preventDefault();
      }
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [enabled, message]);
}
