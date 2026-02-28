import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface InspectorPanelProps {
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  initials: string;
  quickActions: Array<{ label: string; disabled?: boolean }>;
  meta: Array<{ label: string; value: string }>;
}

export function InspectorPanel({ title, subtitle, avatarUrl, initials, quickActions, meta }: InspectorPanelProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14 border border-border">
          <AvatarImage src={avatarUrl ?? ""} alt={title} />
          <AvatarFallback className="bg-[hsl(var(--surface-2))] text-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{title}</p>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quick Actions</h2>
        <div className="grid gap-2">
          {quickActions.map((action) => (
            <Button key={action.label} variant="outline" size="sm" className="justify-start" disabled={action.disabled}>
              {action.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Audit</h2>
        <dl className="space-y-2 rounded-2xl border border-border bg-[hsl(var(--surface-2))] p-3">
          {meta.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-0.5 text-sm">
              <dt className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{entry.label}</dt>
              <dd className="text-foreground">{entry.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
