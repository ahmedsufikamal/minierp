import type { LucideIcon } from "lucide-react";
import { flatNavItems } from "@/components/shell/nav";

export const nav: { href: string; label: string; icon: LucideIcon }[] = Array.from(
  flatNavItems.reduce((acc, item) => {
    if (!acc.has(item.href)) {
      acc.set(item.href, item);
    }
    return acc;
  }, new Map<string, (typeof flatNavItems)[number]>()),
).map(([, item]) => item);
