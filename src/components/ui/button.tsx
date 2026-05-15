import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        ghost: "hover:bg-muted",
        outline: "border border-border bg-background hover:bg-muted",
        brand: "bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-500 text-white shadow-sm hover:brightness-105",
        success: "bg-gradient-to-r from-emerald-600 via-emerald-500 to-lime-500 text-white shadow-sm hover:brightness-105",
        amber: "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 text-slate-950 shadow-sm hover:brightness-105",
        rose: "bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-500 text-white shadow-sm hover:brightness-105",
      },
      size: {
        default: "h-9 px-3",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";
