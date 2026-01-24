import * as React from "react";

export function Card({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        "rounded-2xl border border-slate-200/60 bg-white/80 shadow-sm backdrop-blur " +
        "dark:border-white/10 dark:bg-white/5 " +
        className
      }
      {...props}
    />
  );
}

export function CardContent({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={"p-5 " + className} {...props} />;
}
