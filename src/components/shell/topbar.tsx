"use client";

import { usePathname } from "next/navigation";
import { logout } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MobileNav } from "@/components/shell/mobile-nav";
import { useCommandPalette } from "@/components/command-palette";
import { LogOut, Search } from "lucide-react";

function titleFromPath(pathname: string | null) {
  if (!pathname) return "Dashboard";
  const p = pathname.split("/")[1] || "dashboard";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function Topbar() {
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  const { setOpen: setCommandOpen } = useCommandPalette();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-slate-950/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MobileNav />
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">miniERP</div>
          <div className="text-xl font-semibold tracking-tight">{title}</div>
            <div className="mt-1">
              <Breadcrumbs />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-1.5 sm:inline-flex"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="text-slate-500">Search</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 lg:inline-flex">
              ⌘K
            </kbd>
          </Button>
          <Button onClick={() => logout()} variant="secondary" size="sm" className="gap-2">
            <LogOut size={16} />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
