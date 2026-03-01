import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkbenchTopBarProps {
  breadcrumbs: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function WorkbenchTopBar({
  breadcrumbs,
  actions,
  className,
}: WorkbenchTopBarProps) {
  return (
    <header
      className={cn(
        "min-h-[64px] rounded-2xl border border-border bg-[hsl(var(--surface-1))] px-5 py-3 text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex min-h-[40px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">{breadcrumbs}</div>
        {actions ? <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
