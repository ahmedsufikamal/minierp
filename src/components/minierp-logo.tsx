"use client";

import { cn } from "@/lib/cn";

type MiniERPLogoProps = {
  /** "icon" = symbol only (e.g. auth card). "sm" = compact wordmark. "md" = default sidebar size. */
  size?: "icon" | "sm" | "md";
  className?: string;
};

/**
 * miniERP logo: cube/box icon + wordmark. Use theme colors (e.g. text-foreground or bg-primary with text-primary-foreground).
 */
export function MiniERPLogo({ size = "md", className }: MiniERPLogoProps) {
  const iconOnly = size === "icon";
  const isSmall = size === "sm";

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-semibold tracking-tight", className)}
      aria-label="miniERP"
    >
      <svg
        viewBox="0 0 32 32"
        className={cn(
          "shrink-0",
          iconOnly ? "h-10 w-10" : isSmall ? "h-5 w-5" : "h-6 w-6",
        )}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M6 10l10-5 10 5v12l-10 5-10-5V10z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 5v22M6 10l10 5 10-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!iconOnly && (
        <span className={isSmall ? "text-sm" : "text-base"}>miniERP</span>
      )}
    </span>
  );
}
