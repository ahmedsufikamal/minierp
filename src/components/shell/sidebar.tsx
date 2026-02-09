"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { nav } from "@/config/nav";
import { MiniERPLogo } from "@/components/minierp-logo";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-72 md:flex-col">
      <div className="m-4 rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <MiniERPLogo size="sm" className="text-foreground" />
          <span className="text-xs text-slate-500 dark:text-slate-400">v0.3</span>
        </div>

        <nav className="mt-4 grid gap-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5",
                  active &&
                    "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
