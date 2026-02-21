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
import { navGroups, primaryNavItem } from "@/components/shell/nav";
import { MiniERPLogo } from "@/components/minierp-logo";
import { Menu } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);
  const PrimaryIcon = primaryNavItem.icon;

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
          <div className="flex h-full flex-col border-r border-border bg-[hsl(var(--surface-card))]">
            <div className="border-b border-border p-4">
              <MiniERPLogo size="sm" className="text-foreground" />
            </div>
            <nav className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <ul className="grid gap-1">
                  <li>
                    <Link
                      href={primaryNavItem.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                        "text-foreground/85 hover:bg-[hsl(var(--surface-interactive))] hover:text-foreground",
                        isActive(primaryNavItem.href) &&
                          "bg-[hsl(var(--surface-interactive))] font-medium text-foreground",
                      )}
                      data-testid="mobile-sidebar-dashboard-link"
                      aria-current={isActive(primaryNavItem.href) ? "page" : undefined}
                    >
                      <PrimaryIcon className="h-4 w-4" />
                      {primaryNavItem.label}
                    </Link>
                  </li>
                </ul>
                {navGroups.map((group) => (
                  <section key={group.title} className="space-y-1">
                    <h2 className="px-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </h2>
                    <ul className="grid gap-1">
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                                "text-foreground/85 hover:bg-[hsl(var(--surface-interactive))] hover:text-foreground",
                                active &&
                                  "bg-[hsl(var(--surface-interactive))] font-medium text-foreground",
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
