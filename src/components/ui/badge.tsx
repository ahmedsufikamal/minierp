import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        success:
          "border-[hsl(var(--state-success-border))] bg-[hsl(var(--state-success-bg))] text-[hsl(var(--state-success-fg))]",
        warning:
          "border-[hsl(var(--state-warning-border))] bg-[hsl(var(--state-warning-bg))] text-[hsl(var(--state-warning-fg))]",
        error:
          "border-[hsl(var(--state-error-border))] bg-[hsl(var(--state-error-bg))] text-[hsl(var(--state-error-fg))]",
        info:
          "border-[hsl(var(--state-info-border))] bg-[hsl(var(--state-info-bg))] text-[hsl(var(--state-info-fg))]",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
