"use client";

import Link from "next/link";
import { LogOut, Settings2 } from "lucide-react";
import { logout } from "@/app/auth-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UserChipMenuProps {
  collapsed: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
}

function resolveInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    if (initials) return initials;
  }

  return email?.[0]?.toUpperCase() ?? "U";
}

export function UserChipMenu({ collapsed, user }: UserChipMenuProps) {
  const initials = resolveInitials(user?.name, user?.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto w-full justify-start rounded-2xl border border-border/80 bg-[hsl(var(--surface-2))] px-2.5 py-2.5 hover:bg-[hsl(var(--surface-3))]",
            collapsed && "justify-center px-2",
          )}
          aria-label="Open user menu"
        >
          <Avatar className="h-9 w-9 border border-border/80">
            <AvatarImage src={user?.avatarUrl ?? ""} alt={user?.name || user?.email || "User"} />
            <AvatarFallback className="bg-[hsl(var(--surface-1))] text-foreground">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <span className="ml-3 min-w-0 text-left">
              <span className="block truncate text-sm font-semibold text-foreground">
                {user?.name || "Workspace user"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email || ""}</span>
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64 rounded-2xl border border-border bg-popover p-1.5">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-popover-foreground">{user?.name || "Workspace user"}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email || ""}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl px-3 py-2 text-sm">
          <Link href="/settings/user">
            <Settings2 className="mr-2 h-4 w-4" />
            User Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logout}>
          <Button type="submit" variant="ghost" className="w-full justify-start rounded-xl px-3 py-2 text-sm font-medium">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
