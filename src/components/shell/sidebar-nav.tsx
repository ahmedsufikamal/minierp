"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShellNavSection } from "./shell-config";

interface SidebarNavProps {
  sections: ShellNavSection[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ sections, pathname, collapsed, onNavigate }: SidebarNavProps) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.title} className="space-y-1.5">
          {!collapsed ? (
            <h2 className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.title}
            </h2>
          ) : null}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const itemActive = isActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={`${section.title}-${item.label}-${item.href}`}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={itemActive ? "page" : undefined}
                    className={cn(
                      "focus-ring flex min-h-10 items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors",
                      "text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground",
                      itemActive && "bg-[hsl(var(--surface-3))] text-foreground shadow-sm",
                      collapsed && "justify-center px-2",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <>
                        <span className="truncate">{item.label}</span>
                        {itemActive ? <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" /> : null}
                      </>
                    ) : null}
                  </Link>
                  {!collapsed && item.children?.length ? (
                    <ul className="mt-1 space-y-1 pl-8">
                      {item.children.map((child) => {
                        const childActive = isActive(pathname, child.href);
                        const ChildIcon = child.icon;
                        return (
                          <li key={`${item.label}-${child.label}-${child.href}`}>
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "focus-ring flex min-h-9 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                                "text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground",
                                childActive && "bg-[hsl(var(--surface-2))] text-foreground",
                              )}
                            >
                              <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
