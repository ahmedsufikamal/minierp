"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function AppShell({ children, user }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[hsl(var(--bg))]">
      <div className="flex h-full">
        <div className="hidden md:block">
          <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
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
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMobile={() => setMobileOpen(true)} user={user} />
          <main id="main-content" className="min-h-0 flex-1 overflow-auto p-4 md:p-5" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
