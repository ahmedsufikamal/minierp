"use client";

import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

function titleFromPath(pathname: string | null) {
  if (!pathname) return "Dashboard";
  const p = pathname.split("/")[1] || "dashboard";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function Topbar() {
  const pathname = usePathname();
  const title = titleFromPath(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-slate-950/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">miniERP</div>
          <div className="text-xl font-semibold tracking-tight">{title}</div>
        </div>

        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
