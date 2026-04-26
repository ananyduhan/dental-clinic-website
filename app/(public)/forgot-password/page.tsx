"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  function onSubmit(data: ForgotPasswordInput) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const json = await res.json() as { error?: string };
          toast({ title: "Error", description: json.error ?? "Please try again.", variant: "destructive" });
          return;
        }

        setSent(true);
      } catch {
        toast({ title: "Something went wrong", description: "Please check your connection.", variant: "destructive" });
      }
    });
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm animate-fade-in text-center">
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
          <div className="h-16 w-16 rounded-full bg-[var(--color-valid-tint)] flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-[var(--color-cta)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-feature)] mb-2">Check your email</h2>
          <p className="text-sm text-[var(--color-text-soft)] mb-2">
            We sent a password reset link to
          </p>
          <p className="text-sm font-semibold text-[var(--color-text)] mb-6">
            {getValues("email")}
          </p>
          <p className="text-xs text-[var(--color-text-soft)] mb-6">
            Didn&apos;t receive it? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-[var(--color-cta)] hover:underline"
            >
              try again
            </button>
            .
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">Back to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm animate-fade-in">
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-full bg-[var(--color-green-light)] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-[var(--color-cta)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight mb-2">
            Reset your password
          </h1>
          <p className="text-sm text-[var(--color-text-soft)]">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              error={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full" size="lg">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[var(--color-cta)] hover:underline font-medium">
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
