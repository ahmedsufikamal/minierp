"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShellNavItem, ShellNavSection } from "./shell-config";

interface SidebarNavProps {
  sections: ShellNavSection[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function matchesItem(pathname: string, item: ShellNavItem): boolean {
  if (item.href && isActive(pathname, item.href)) {
    return true;
  }
  return (item.children ?? []).some((child) => matchesItem(pathname, child));
}

function getItemKey(sectionIndex: number, item: ShellNavItem): string {
  return `${sectionIndex}:${item.label}:${item.href ?? "toggle"}`;
}

function buildInitialExpanded(
  sections: ShellNavSection[],
  pathname: string,
): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};

  for (const [sectionIndex, section] of sections.entries()) {
    for (const item of section.items) {
      if (!item.href && item.children?.length) {
        expanded[getItemKey(sectionIndex, item)] =
          Boolean(item.defaultExpanded) ||
          item.children.some((child) => matchesItem(pathname, child));
      }
    }
  }

  return expanded;
}

export function SidebarNav({ sections, pathname, collapsed, onNavigate }: SidebarNavProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    buildInitialExpanded(sections, pathname),
  );

  useEffect(() => {
    setExpanded((current) => {
      let changed = false;
      const next = { ...current };

      for (const [sectionIndex, section] of sections.entries()) {
        for (const item of section.items) {
          if (!item.href && item.children?.length) {
            const key = getItemKey(sectionIndex, item);
            const shouldExpand =
              Boolean(item.defaultExpanded) ||
              item.children.some((child) => matchesItem(pathname, child));
            if (shouldExpand && !next[key]) {
              next[key] = true;
              changed = true;
            }
            if (!(key in next)) {
              next[key] = shouldExpand;
              changed = true;
            }
          }
        }
      }

      return changed ? next : current;
    });
  }, [pathname, sections]);

  return (
    <div className="space-y-5">
      {sections.map((section, sectionIndex) => (
        <section key={section.title ?? `section-${sectionIndex}`} className="space-y-1.5">
          {!collapsed && section.title ? (
            <h2 className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {section.title}
            </h2>
          ) : null}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const itemKey = getItemKey(sectionIndex, item);
              const itemActive = item.href ? isActive(pathname, item.href) : false;
              const childActive = (item.children ?? []).some((child) =>
                matchesItem(pathname, child),
              );
              const isExpanded =
                !item.href && item.children?.length ? (expanded[itemKey] ?? false) : false;

              return (
                <li key={itemKey}>
                  {item.href ? (
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
                          {itemActive ? (
                            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [itemKey]: !(current[itemKey] ?? false),
                        }))
                      }
                      title={collapsed ? item.label : undefined}
                      aria-label={item.label}
                      aria-expanded={!collapsed ? isExpanded : undefined}
                      className={cn(
                        "focus-ring flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors",
                        "text-muted-foreground hover:bg-[hsl(var(--surface-2))] hover:text-foreground",
                        childActive && "bg-[hsl(var(--surface-3))] text-foreground shadow-sm",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? (
                        <>
                          <span className="truncate">{item.label}</span>
                          <ChevronRight
                            className={cn(
                              "ml-auto h-3.5 w-3.5 opacity-60 transition-transform",
                              isExpanded && "rotate-90",
                            )}
                          />
                        </>
                      ) : null}
                    </button>
                  )}
                  {!collapsed && item.children?.length && (item.href || isExpanded) ? (
                    <ul className="mt-1 space-y-1 pl-8">
                      {item.children.map((child) => {
                        if (!child.href) return null;
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
