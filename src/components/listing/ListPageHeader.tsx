import type { ReactNode } from "react";
import { WorkbenchTopBar } from "@/components/listing/WorkbenchTopBar";
import { cn } from "@/lib/utils";

interface ListPageHeaderProps {
  breadcrumbs: ReactNode;
  toolbar: ReactNode;
  quickFilters: ReactNode;
  actions: ReactNode;
  className?: string;
}

export function ListPageHeader({
  breadcrumbs,
  toolbar,
  quickFilters,
  actions,
  className,
}: ListPageHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <WorkbenchTopBar
        breadcrumbs={breadcrumbs}
        actions={<div className="flex flex-wrap items-center gap-3">{toolbar}</div>}
      />
      <section className="rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1 overflow-hidden">{quickFilters}</div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        </div>
      </section>
    </div>
  );
}
