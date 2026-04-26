import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[50px] px-3 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-[var(--color-cta)] text-white",
        outline:     "border border-[var(--color-cta)] text-[var(--color-cta)] bg-transparent",
        secondary:   "bg-[var(--color-green-light)] text-[var(--color-feature)]",
        ceramic:     "bg-[var(--color-ceramic)] text-[var(--color-text)]",
        pending:     "bg-amber-100 text-amber-800 border border-amber-200",
        confirmed:   "bg-[var(--color-valid-tint)] text-[var(--color-feature)] border border-[var(--color-green-light)]",
        cancelled:   "bg-red-50 text-red-700 border border-red-200",
        completed:   "bg-[var(--color-ceramic)] text-[var(--color-text-soft)] border border-[var(--color-border)]",
        destructive: "bg-[var(--color-error-tint)] text-[var(--color-error)] border border-[var(--color-error)]/20",
        active:      "bg-[var(--color-cta)] text-white",
        inactive:    "bg-[var(--color-ceramic)] text-[var(--color-text-soft)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
