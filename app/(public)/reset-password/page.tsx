"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { toast } = useToast();

  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  function onSubmit(data: ResetPasswordInput) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json() as { error?: string };

        if (!res.ok) {
          toast({ title: "Reset failed", description: json.error ?? "The link may have expired. Please request a new one.", variant: "destructive" });
          return;
        }

        setSuccess(true);
      } catch {
        toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
      }
    });
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm animate-fade-in text-center">
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
          <h2 className="text-xl font-bold text-[var(--color-feature)] mb-3">Invalid link</h2>
          <p className="text-sm text-[var(--color-text-soft)] mb-6">
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <Link href="/forgot-password">
            <Button className="w-full">Request New Link</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm animate-fade-in text-center">
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
          <div className="h-16 w-16 rounded-full bg-[var(--color-valid-tint)] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-[var(--color-cta)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-feature)] mb-2">Password updated!</h2>
          <p className="text-sm text-[var(--color-text-soft)] mb-6">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <Button onClick={() => router.push("/login")} className="w-full">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm animate-fade-in">
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight mb-2">
            Choose a new password
          </h1>
          <p className="text-sm text-[var(--color-text-soft)]">
            Must be at least 8 characters with one uppercase and one number.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <input type="hidden" {...register("token")} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                autoComplete="new-password"
                error={!!errors.password}
                className="pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)] hover:text-[var(--color-text)] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p role="alert" className="text-xs text-[var(--color-error)]">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Repeat your password"
              autoComplete="new-password"
              error={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p role="alert" className="text-xs text-[var(--color-error)]">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full" size="lg">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Updating password…</>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm h-96 rounded-[var(--radius-card)] skeleton-shimmer" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
