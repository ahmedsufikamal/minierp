"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { MiniERPLogo } from "@/components/minierp-logo";
import { Button } from "@/components/ui/button";
import { navGroups, primaryNavItem } from "./nav";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed, mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const PrimaryIcon = primaryNavItem.icon;

  return (
    <aside
      className={cn(
        "h-full border-r border-border bg-[hsl(var(--surface-1))]",
        collapsed ? "w-[88px]" : "w-[272px]",
      )}
      aria-label="Primary"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={onNavigate}>
            <MiniERPLogo size="sm" showWordmark={!collapsed} className="text-foreground" />
            {!collapsed && <span className="text-xs text-muted-foreground">Workbench</span>}
          </Link>
          {!mobile && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              data-testid="sidebar-toggle"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" data-testid="sidebar-nav-root">
          <ul className="mb-4 space-y-1">
            <li key={primaryNavItem.href}>
              <Link
                href={primaryNavItem.href}
                onClick={onNavigate}
                className={cn(
                  "focus-ring flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition",
                  "hover:bg-[hsl(var(--surface-3))] hover:text-foreground",
                  isActive(primaryNavItem.href) && "bg-[hsl(var(--surface-3))] text-foreground",
                  collapsed && "justify-center",
                )}
                title={collapsed ? primaryNavItem.label : undefined}
                aria-current={isActive(primaryNavItem.href) ? "page" : undefined}
                data-testid="sidebar-dashboard-link"
              >
                <PrimaryIcon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{primaryNavItem.label}</span>}
                {!collapsed && isActive(primaryNavItem.href) && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-70" />}
              </Link>
            </li>
          </ul>

          {navGroups.map((group) => (
            <section key={group.title} className="mb-4">
              {!collapsed && (
                <h2 className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h2>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <li key={`${group.title}-${item.label}-${item.href}`}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "focus-ring flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition",
                          "hover:bg-[hsl(var(--surface-3))] hover:text-foreground",
                          active && "bg-[hsl(var(--surface-3))] text-foreground",
                          collapsed && "justify-center",
                        )}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-70" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        {mobile && (
          <div className="border-t border-border p-2">
            <Button variant="outline" className="w-full justify-center" onClick={onToggleCollapsed}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Close
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
