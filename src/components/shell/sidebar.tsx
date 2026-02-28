"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { MiniERPLogo } from "@/components/minierp-logo";
import { Button } from "@/components/ui/button";
import { useCommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";
import { ModuleSwitcher } from "./module-switcher";
import { SidebarNav } from "./sidebar-nav";
import { formatModuleSubtext, resolveActiveModule, shellHomeItems, shellModules } from "./shell-config";
import { UserChipMenu } from "./user-chip-menu";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobile?: boolean;
  onNavigate?: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    activeCompanyId?: string | null;
  } | null;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ collapsed, onToggleCollapsed, mobile = false, onNavigate, user }: SidebarProps) {
  const pathname = usePathname() || "/dashboard";
  const activeModule = resolveActiveModule(pathname);
  const { setOpen: setCommandOpen } = useCommandPalette();

  return (
    <aside
      className={cn(
        "h-full border-r border-border bg-[hsl(var(--surface-1))]",
        collapsed ? "w-[92px]" : "w-[290px]",
      )}
      aria-label="Primary"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-3 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link href="/dashboard" className="min-w-0" onClick={onNavigate}>
              <MiniERPLogo size="sm" showWordmark={!collapsed} className="text-foreground" />
            </Link>
            {!mobile ? (
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
            ) : null}
          </div>
          <ModuleSwitcher
            activeModule={activeModule}
            modules={shellModules}
            collapsed={collapsed}
            subtext={formatModuleSubtext({
              email: user?.email,
              companyLabel: user?.activeCompanyId ? `Workspace ${user.activeCompanyId.slice(0, 8)}` : null,
            })}
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" data-testid="sidebar-nav-root">
          <div className="space-y-5">
            <div className="space-y-1">
              {shellHomeItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring flex min-h-10 items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors",
                      "text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground",
                      active && "bg-[hsl(var(--surface-3))] text-foreground shadow-sm",
                      collapsed && "justify-center px-2",
                    )}
                    data-testid={item.href === "/dashboard" ? "sidebar-dashboard-link" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="truncate font-medium">{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>

            <div className="space-y-1">
              {!collapsed ? (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Quick Access
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCommandOpen(true);
                  onNavigate?.();
                }}
                title={collapsed ? "Search" : undefined}
                aria-label="Search"
                className={cn(
                  "focus-ring flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-colors",
                  "hover:bg-[hsl(var(--surface-2))] hover:text-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                <Search className="h-4 w-4 shrink-0" />
                {!collapsed ? <span className="truncate">Search</span> : null}
              </button>
              <Link
                href="/settings/user"
                onClick={onNavigate}
                title={collapsed ? "Notifications" : undefined}
                aria-label="Notifications"
                className={cn(
                  "focus-ring flex min-h-10 items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-muted-foreground transition-colors",
                  "hover:bg-[hsl(var(--surface-2))] hover:text-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                <Bell className="h-4 w-4 shrink-0" />
                {!collapsed ? <span className="truncate">Notifications</span> : null}
              </Link>
            </div>

            <SidebarNav sections={activeModule.sections} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          </div>
        </nav>

        <div className="border-t border-border px-3 py-3">
          <UserChipMenu collapsed={collapsed} user={user} />
          {mobile ? (
            <Button variant="outline" className="mt-2 w-full justify-center" onClick={onToggleCollapsed}>
              Close
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
