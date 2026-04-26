"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, CheckCircle2, Circle } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter",  ok: /[A-Z]/.test(password) },
    { label: "One number",            ok: /[0-9]/.test(password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const strengthColor =
    passed === 0 ? "bg-[var(--color-border)]" :
    passed === 1 ? "bg-[var(--color-error)]" :
    passed === 2 ? "bg-[var(--color-warning)]" :
    "bg-[var(--color-cta)]";

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-[var(--duration-normal)] ${i < passed ? strengthColor : "bg-[var(--color-border)]"}`}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1">
        {checks.map(({ label, ok }) => (
          <li key={label} className="flex items-center gap-1.5 text-xs">
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-cta)] shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-[var(--color-border)] shrink-0" />
            )}
            <span className={ok ? "text-[var(--color-cta)]" : "text-[var(--color-text-soft)]"}>
              {label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [success, setSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  const password = watch("password", "");

  function onSubmit(data: RegisterInput) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json() as { error?: string };

        if (!res.ok) {
          toast({ title: "Registration failed", description: json.error ?? "Please try again.", variant: "destructive" });
          return;
        }

        setSuccess(true);
      } catch {
        toast({ title: "Something went wrong", description: "Please check your connection and try again.", variant: "destructive" });
      }
    });
  }

  if (success) {
    return (
      <div className="w-full max-w-sm animate-fade-in text-center">
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
          <div className="h-16 w-16 rounded-full bg-[var(--color-valid-tint)] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-[var(--color-cta)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-feature)] mb-2">Account created!</h2>
          <p className="text-sm text-[var(--color-text-soft)] mb-6">
            We&apos;ve sent a verification link to your email. Please check your inbox and verify before signing in.
          </p>
          <Button onClick={() => router.push("/login")} className="w-full">
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight mb-2">
            Create your account
          </h1>
          <p className="text-sm text-[var(--color-text-soft)]">
            Join BrightSmile Dental and book appointments online
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" placeholder="Jane" autoComplete="given-name" error={!!errors.firstName} {...register("firstName")} />
              {errors.firstName && <p role="alert" className="text-xs text-[var(--color-error)]">{errors.firstName.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" placeholder="Smith" autoComplete="family-name" error={!!errors.lastName} {...register("lastName")} />
              {errors.lastName && <p role="alert" className="text-xs text-[var(--color-error)]">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" placeholder="jane@example.com" autoComplete="email" error={!!errors.email} {...register("email")} />
            {errors.email && <p role="alert" className="text-xs text-[var(--color-error)]">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" type="tel" placeholder="+61412345678" autoComplete="tel" error={!!errors.phone} {...register("phone")} />
            {errors.phone && <p role="alert" className="text-xs text-[var(--color-error)]">{errors.phone.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
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
            {password && <PasswordStrength password={password} />}
            {errors.password && <p role="alert" className="text-xs text-[var(--color-error)]">{errors.password.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Repeat your password"
              autoComplete="new-password"
              error={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && <p role="alert" className="text-xs text-[var(--color-error)]">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" disabled={isPending} className="w-full mt-1" size="lg">
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating account…</> : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--color-text-soft)]">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[var(--color-cta)] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
