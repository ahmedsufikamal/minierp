import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-slate-200/60 bg-white px-3 text-sm text-slate-900 " +
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 " +
          "dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400",
        className
      )}
      {...props}
    />
  );
}
