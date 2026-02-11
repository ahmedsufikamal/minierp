import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
      <div className="space-y-1">
        {breadcrumb ? <div className="text-xs text-muted-foreground">{breadcrumb}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
