import { cn } from "@/lib/cn";
import { Info } from "lucide-react";

interface BannerProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function Banner({ title, description, action, className }: BannerProps) {
  return (
    <section className={cn("surface-2 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between", className)}>
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 text-[hsl(var(--accent-solid))]" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </section>
  );
}
