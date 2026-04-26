import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2 text-sm",
          "bg-[var(--color-surface)] text-[var(--color-text)]",
          "placeholder:text-[var(--color-text-soft)]",
          "border-[var(--color-border)]",
          "transition-colors duration-[var(--duration-fast)]",
          "focus-visible:outline-none focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          error && "border-[var(--color-error)] bg-[var(--color-error-tint)] focus-visible:ring-[var(--color-error)]/20",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
