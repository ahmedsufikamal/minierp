"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { navGroups } from "@/components/shell/nav";
import { MiniERPLogo } from "@/components/minierp-logo";
import { Menu } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="fixed left-0 top-0 h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none border-0 border-r p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Navigation menu</DialogTitle>
          <div className="flex h-full flex-col border-r border-slate-200/60 bg-white dark:border-white/10 dark:bg-slate-950">
            <div className="border-b border-slate-200/60 p-4 dark:border-white/10">
              <MiniERPLogo size="sm" className="text-foreground" />
            </div>
            <nav className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                {navGroups.map((group) => (
                  <section key={group.title} className="space-y-1">
                    <h2 className="px-3 pb-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {group.title}
                    </h2>
                    <ul className="grid gap-1">
                      {group.items.map((item) => {
                        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                                "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5",
                                active &&
                                  "bg-slate-900 font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </nav>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
