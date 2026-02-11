"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { nav } from "@/config/nav";
import { MiniERPLogo } from "@/components/minierp-logo";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-80 md:flex-col">
      <div className="m-4 rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-5 shadow-elevated">
        <div className="flex items-center justify-between mb-6">
          <MiniERPLogo size="sm" className="text-foreground" />
          <span className="text-xs text-muted-foreground font-medium">v0.3</span>
        </div>

        <nav className="grid gap-1.5">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 relative",
                  "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  active &&
                    "bg-primary text-primary-foreground shadow-md hover:bg-primary/90",
                  !active && "hover:translate-x-1"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground rounded-r-full" />
                )}
                <Icon className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  active && "scale-110"
                )} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
