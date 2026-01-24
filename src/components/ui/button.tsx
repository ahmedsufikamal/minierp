import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 " +
    "disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-white text-slate-900 hover:bg-slate-100 " +
          "dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
        dark:
          "bg-slate-900 text-white hover:bg-slate-800 " +
          "dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
        outline:
          "border border-slate-200/60 bg-transparent text-slate-900 hover:bg-slate-50 " +
          "dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/5",
        ghost:
          "bg-transparent text-slate-900 hover:bg-slate-100 " +
          "dark:text-slate-100 dark:hover:bg-white/5",
        danger:
          "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "dark",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
