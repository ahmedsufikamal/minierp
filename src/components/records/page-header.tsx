import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RecordPageHeaderProps {
  breadcrumbs: React.ReactNode;
  title: string;
  subtitle?: string;
  status?: { label: string; variant?: "success" | "warning" | "outline" | "secondary" | "error" | "info" };
  actions?: React.ReactNode;
  className?: string;
}

export function RecordPageHeader({
  breadcrumbs,
  title,
  subtitle,
  status,
  actions,
  className,
}: RecordPageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 rounded-3xl border border-border bg-card px-5 py-5 text-card-foreground shadow-sm", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{breadcrumbs}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            {status ? <Badge variant={status.variant ?? "outline"}>{status.label}</Badge> : null}
          </div>
          {subtitle ? <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
