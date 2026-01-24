import * as React from "react";
import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
          "border-slate-200/60 bg-slate-50 text-slate-700 " +
          "dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
        className
      )}
      {...props}
    />
  );
}
