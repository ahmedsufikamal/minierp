import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";
import { flattenShellNavItems, shellModules, type ShellNavItem } from "./shell-config";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const primaryNavItem: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
};

function toNavItem(item: ShellNavItem): NavItem {
  return { href: item.href, label: item.label, icon: item.icon };
}

export const navGroups: NavGroup[] = shellModules.flatMap((module) =>
  module.sections.map((section) => ({
    title: `${module.label} · ${section.title}`,
    items: section.items.flatMap((item) => [toNavItem(item), ...(item.children ?? []).map(toNavItem)]),
  })),
);

export const flatNavItems: NavItem[] = [primaryNavItem, ...flattenShellNavItems().map(toNavItem)].reduce<NavItem[]>(
  (acc, item) => {
    if (!acc.some((entry) => entry.href === item.href)) {
      acc.push(item);
    }
    return acc;
  },
  [],
);
