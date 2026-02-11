"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MobileNav } from "@/components/shell/mobile-nav";
import { useCommandPalette } from "@/components/command-palette";
import { UserMenu } from "@/components/user-menu";
import { Search } from "lucide-react";

function titleFromPath(pathname: string | null) {
  if (!pathname) return "Dashboard";
  const p = pathname.split("/")[1] || "dashboard";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

interface TopbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  const { setOpen: setCommandOpen } = useCommandPalette();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <MobileNav />
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">miniERP</div>
            <div className="text-2xl font-bold tracking-tight">{title}</div>
            <div className="mt-1">
              <Breadcrumbs />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-2 sm:inline-flex hover:bg-accent"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="text-muted-foreground">Search</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-flex">
              ⌘K
            </kbd>
          </Button>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
