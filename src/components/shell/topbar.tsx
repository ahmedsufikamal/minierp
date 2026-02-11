"use client";

import { Menu, Plus, Search, Sparkles, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCommandPalette } from "@/components/command-palette";
import { UserMenu } from "@/components/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onOpenMobile: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function Topbar({ onOpenMobile, user }: TopbarProps) {
  const { setOpen: setCommandOpen } = useCommandPalette();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-[hsl(var(--surface-1))] px-3 md:px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMobile} aria-label="Open sidebar">
        <Menu className="h-4 w-4" />
      </Button>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className={cn(
          buttonVariants({ variant: "utility", size: "sm" }),
          "h-9 w-full max-w-xl justify-start gap-2 bg-[hsl(var(--surface-2))] px-3 text-left font-normal text-muted-foreground",
        )}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Search customers, invoices, products...</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[10px] md:inline">
          Cmd+K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>New invoice</DropdownMenuItem>
            <DropdownMenuItem>New quote</DropdownMenuItem>
            <DropdownMenuItem>New customer</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="hidden md:inline-flex">
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
        <Button variant="ghost" size="sm" className="hidden md:inline-flex">
          <Sparkles className="mr-1 h-4 w-4" /> AI
        </Button>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
