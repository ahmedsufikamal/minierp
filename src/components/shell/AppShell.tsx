"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { readStoredSidebarCollapsed, writeStoredSidebarCollapsed } from "./sidebar-state";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    activeCompanyId?: string | null;
    isImpersonating?: boolean | null;
    impersonatorUserId?: string | null;
    impersonationExpiresAt?: string | Date | null;
  } | null;
}

export function AppShell({ children, user }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session/bridge", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    setCollapsed(readStoredSidebarCollapsed());
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!sidebarReady) return;
    writeStoredSidebarCollapsed(collapsed);
  }, [collapsed, sidebarReady]);

  useEffect(() => {
    if (!user?.isImpersonating || !user.impersonationExpiresAt) return;
    const expiresAt = new Date(user.impersonationExpiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return;
    const delayMs = expiresAt - Date.now();
    if (delayMs <= 0) {
      window.location.reload();
      return;
    }
    const timeoutId = window.setTimeout(() => {
      window.location.reload();
    }, delayMs + 250);
    return () => window.clearTimeout(timeoutId);
  }, [user?.isImpersonating, user?.impersonationExpiresAt]);

  return (
    <div className="h-screen overflow-hidden bg-[hsl(var(--bg))]">
      <div className="flex h-full">
        <div className="hidden md:block">
          <Sidebar
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            user={user}
          />
        </div>

        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent
            className="left-0 top-0 h-screen w-[86vw] max-w-[320px] translate-x-0 translate-y-0 rounded-none border-0 p-0"
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <Sidebar
              collapsed={false}
              onToggleCollapsed={() => setMobileOpen(false)}
              user={user}
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMobile={() => setMobileOpen(true)} />
          {user?.isImpersonating ? (
            <div className="state-warning flex items-center justify-between gap-3 border-b px-4 py-2 text-xs">
              <span>
                Impersonation active
                {user.impersonationExpiresAt
                  ? ` · Expires ${new Date(user.impersonationExpiresAt).toLocaleTimeString()}`
                  : ""}
              </span>
              <button
                className="rounded border border-[hsl(var(--state-warning-border))] bg-transparent px-2 py-1 text-[hsl(var(--state-warning-fg))] disabled:opacity-60"
                disabled={stoppingImpersonation}
                onClick={async () => {
                  setStoppingImpersonation(true);
                  try {
                    await fetch("/api/admin/impersonation/stop", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: "{}",
                      credentials: "same-origin",
                    });
                    window.location.reload();
                  } finally {
                    setStoppingImpersonation(false);
                  }
                }}
              >
                {stoppingImpersonation ? "Stopping..." : "Stop impersonation"}
              </button>
            </div>
          ) : null}
          <main id="main-content" className="min-h-0 flex-1 overflow-auto p-4 md:p-5" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
