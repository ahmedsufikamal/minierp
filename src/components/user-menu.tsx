"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { logout } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  CalendarCheck2,
  CreditCard,
  Languages,
  LogOut,
  Palette,
  Rocket,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const { theme = "system", setTheme } = useTheme();
  const [language, setLanguage] = useState("en");

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0].toUpperCase() || "U";

  const rowClass = cn(
    "focus-ring group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5",
    "text-[17px] font-medium text-foreground/90",
    "focus:bg-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-3))] focus:text-foreground",
  );

  const iconClass = "h-5 w-5 shrink-0 text-muted-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-transparent">
          <Avatar className="h-10 w-10">
            <AvatarImage src="" alt={user?.name || "User"} />
            <AvatarFallback className="bg-emerald-700 text-emerald-50 font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        forceMount
        sideOffset={10}
        className="w-[300px] rounded-2xl border border-border bg-[hsl(var(--surface-1))] p-2 shadow-elevated"
      >
        <DropdownMenuItem asChild className={rowClass}>
          <Link href="/settings/user">
            <UserRound className={iconClass} />
            <span>Your profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={rowClass}>
          <Link href="/settings/user/sessions">
            <Bell className={iconClass} />
            <span>Activity &amp; notifications</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="mx-3 my-2" />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={rowClass}>
            <Palette className={iconClass} />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            sideOffset={8}
            className="w-44 rounded-xl border border-border bg-[hsl(var(--surface-1))] p-1.5"
          >
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">Automatic (System)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={rowClass}>
            <Languages className={iconClass} />
            <span>Language</span>
            <span className="ml-1 rounded-full border border-[hsl(var(--state-info-border))] bg-[hsl(var(--state-info-bg))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--state-info-fg))]">
              Beta
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            sideOffset={8}
            className="w-44 rounded-xl border border-border bg-[hsl(var(--surface-1))] p-1.5"
          >
            <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
              <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="es">Spanish</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="fr">French</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="mx-3 my-2" />

        <DropdownMenuItem asChild className={rowClass}>
          <Link href="/settings/user/api">
            <CreditCard className={iconClass} />
            <span>View credit usage</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className={rowClass}>
          <Link href="/settings/user">
            <Rocket className={iconClass} />
            <span>Upgrade Plan</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="mx-3 my-2" />

        <DropdownMenuItem asChild className={cn(rowClass, "items-start py-3")}>
          <Link href="/settings/user">
            <CalendarCheck2 className={cn(iconClass, "mt-0.5")} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span>Onboarding hub</span>
              <div className="h-1 rounded-full bg-[hsl(var(--surface-3))]">
                <div className="h-1 w-[37%] rounded-full bg-foreground/85" />
              </div>
              <span className="text-xs text-muted-foreground">37% Completed</span>
            </div>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="mx-3 my-2" />

        <form action={logout} className="px-1 pb-1">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className={cn(rowClass, "h-auto w-full justify-start px-3 py-2.5 text-[17px] font-medium")}
          >
            <LogOut className={iconClass} />
            <span>Log out</span>
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
