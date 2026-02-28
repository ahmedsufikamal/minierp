import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsListItem = {
  label: string;
  href: string;
  description?: string;
};

interface SettingsListProps {
  title?: string;
  items: SettingsListItem[];
  className?: string;
}

export function SettingsList({ title, items, className }: SettingsListProps) {
  return (
    <section className={cn("rounded-3xl border border-border bg-card text-card-foreground shadow-sm", className)}>
      {title ? <div className="border-b border-border px-5 py-4 text-sm font-semibold text-foreground">{title}</div> : null}
      <div className="divide-y divide-border">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{item.label}</span>
              {item.description ? <span className="block text-xs text-muted-foreground">{item.description}</span> : null}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}
