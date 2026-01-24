import * as React from "react";

type Variant = "dark" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

function classes(variant: Variant, size: Size) {
  const base =
    "inline-flex items-center justify-center rounded-xl text-sm font-medium transition " +
    "focus:outline-none focus:ring-2 focus:ring-slate-400/30 disabled:opacity-60 disabled:pointer-events-none";

  const v: Record<Variant, string> = {
    dark: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100",
    outline:
      "border border-slate-200/60 bg-transparent text-slate-900 hover:bg-slate-50 " +
      "dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/5",
    ghost: "bg-transparent text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/5",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const s: Record<Size, string> = {
    sm: "h-9 px-3",
    md: "h-10 px-4",
    lg: "h-11 px-5",
  };

  return `${base} ${v[variant]} ${s[size]}`;
}

export function Button({
  variant = "dark",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={classes(variant, size) + " " + className} {...props} />;
}
