import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm",
          "bg-[var(--color-surface)] text-[var(--color-text)]",
          "placeholder:text-[var(--color-text-soft)]",
          "border-[var(--color-border)]",
          "transition-colors duration-[var(--duration-fast)]",
          "focus-visible:outline-none focus-visible:border-[var(--color-border-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          error && "border-[var(--color-error)] bg-[var(--color-error-tint)]",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
