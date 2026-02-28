export const SIDEBAR_STORAGE_KEY = "minierp-sidebar-collapsed";

export function normalizeSidebarCollapsed(value: string | null | undefined): boolean {
  return value === "1" || value === "true";
}

export function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return normalizeSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function writeStoredSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}
