import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-semibold tracking-tight",
    "rounded-[50px]",
    "transition-all duration-[150ms] ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-95",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-cta)] text-white border border-[var(--color-cta)] hover:bg-[#005a38]",
        outline:
          "bg-transparent text-[var(--color-cta)] border border-[var(--color-cta)] hover:bg-[var(--color-green-light)]/40",
        dark: "bg-black text-white border border-black hover:bg-gray-800",
        "dark-outline":
          "bg-transparent text-[var(--color-text)] border border-[var(--color-text)] hover:bg-[var(--color-ceramic)]",
        "ghost-invert":
          "bg-white text-[var(--color-cta)] border border-white hover:bg-white/90",
        "outline-invert":
          "bg-transparent text-white border border-white hover:bg-white/10",
        destructive:
          "bg-[var(--color-error)] text-white border border-[var(--color-error)] hover:bg-red-700",
        ghost:
          "bg-transparent text-[var(--color-text)] border border-transparent hover:bg-[var(--color-ceramic)]",
        link: "bg-transparent text-[var(--color-cta)] border-transparent underline-offset-4 hover:underline",
        secondary:
          "bg-[var(--color-green-light)] text-[var(--color-feature)] border border-[var(--color-green-light)] hover:bg-[#c0ddd5]",
      },
      size: {
        sm:      "h-8 px-4 py-1 text-sm",
        default: "h-10 px-6 py-2 text-base",
        lg:      "h-12 px-8 py-3 text-base",
        xl:      "h-14 px-10 py-4 text-lg",
        icon:    "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
