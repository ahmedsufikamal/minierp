import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/95 hover:shadow-md",
        gradient:
          "border border-transparent bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.82)_100%)] text-primary-foreground shadow-sm hover:brightness-105 hover:shadow-md",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border border-border bg-[hsl(var(--surface-1))] text-[hsl(var(--text))] shadow-sm hover:border-[hsl(var(--ring)/0.45)] hover:bg-[hsl(var(--surface-interactive))]",
        secondary:
          "border border-border bg-[hsl(var(--surface-2))] text-[hsl(var(--text))] shadow-sm hover:bg-[hsl(var(--surface-interactive))]",
        ghost: "border border-transparent bg-transparent text-[hsl(var(--text))] hover:bg-[hsl(var(--surface-interactive))]",
        utility:
          "border border-border bg-transparent text-muted-foreground hover:bg-[hsl(var(--surface-interactive))] hover:text-[hsl(var(--text))]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        xs: "h-7 rounded-md px-2.5 text-xs",
        sm: "h-9 rounded-md px-3 text-sm",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
