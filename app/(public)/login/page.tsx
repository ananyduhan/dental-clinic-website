"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2, MailWarning } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DEMO_ACCOUNTS, isDemoMode, type DemoAccount } from "@/lib/demo";

/**
 * Resolve where to send the user after a successful sign-in.
 *
 * Only same-origin, path-relative destinations are honoured. A crafted
 * `?callbackUrl=https://evil.example/login` would otherwise turn this page into
 * an open redirect — a convincing phishing hop, since the user really did just
 * authenticate on the genuine site. `//evil.example` is protocol-relative and is
 * rejected for the same reason.
 */
function safeRedirectTarget(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/**
 * Turn a NextAuth sign-in rejection into something a patient can act on.
 *
 * `error` is the Auth.js error *type*, `code` is what `lib/auth.ts` set on the
 * error it threw. Neither is fit to show a user: before this existed the raw
 * `error` was passed straight to the toast, so a wrong password produced a
 * message reading, in full, "Configuration".
 *
 * A non-`CredentialsSignin` type means the failure was ours, not theirs — say
 * so rather than sending them off to re-check a password that was fine.
 */
function describeSignInError(result: { error?: string; code?: string }): string {
  if (result.error !== "CredentialsSignin") {
    return "Something went wrong on our end. Please try again in a moment.";
  }
  if (result.code === "email_not_verified") {
    return "Please verify your email address before signing in — check your inbox for the verification link.";
  }
  return "Invalid email or password. Please try again.";
}

/**
 * The way out of an unverified account.
 *
 * `describeSignInError` tells the user to check their inbox, but the link there
 * expires after 24 hours and may never have arrived at all. Without a resend
 * this is a dead end: sign-in refuses them, registering again is refused as a
 * duplicate, and nothing on the page moves them forward.
 *
 * Rendered inline rather than in the toast because the toast dismisses itself
 * and this needs to stay put until acted on. The address comes from the attempt
 * they just made, so there is nothing to retype.
 */
function ResendVerification({
  email,
  isSending,
  hasSent,
  onResend,
}: {
  email: string;
  isSending: boolean;
  hasSent: boolean;
  onResend: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-error-tint)] p-4 animate-fade-in"
    >
      <div className="flex gap-3">
        <MailWarning
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-[var(--color-error)] mt-0.5"
        />
        <div className="flex flex-col gap-2 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Verify your email to sign in
          </p>
          <p className="text-xs text-[var(--color-text-soft)] break-words">
            We sent a link to <span className="font-medium">{email}</span>. Links
            expire after 24 hours — send yourself a fresh one if you need it.
          </p>

          {hasSent ? (
            <p className="text-xs font-medium text-[var(--color-cta)]">
              Sent. Check your inbox, and your spam folder.
            </p>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={isSending}
              className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-cta)] underline underline-offset-2 rounded-sm transition-colors duration-[var(--duration-fast)] hover:text-[#005a38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending && <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />}
              {isSending ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One-click sign-in for the public demo deployment.
 *
 * Registration only ever creates a PATIENT, so without this the admin and
 * dentist dashboards are unreachable to anyone visiting the deployed site.
 * These credentials are seed data and are printed on the page on purpose —
 * see lib/demo.ts. The panel disappears entirely when NEXT_PUBLIC_DEMO_MODE
 * is not "true".
 */
function DemoSignIn({
  isPending,
  onPick,
}: {
  isPending: boolean;
  onPick: (account: DemoAccount) => void;
}) {
  return (
    <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-soft)] text-center mb-3">
        Or explore the demo
      </p>
      <div className="flex flex-col gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            disabled={isPending}
            onClick={() => onPick(account)}
            className="w-full text-left rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-3 transition-all duration-[var(--duration-fast)] hover:border-[var(--color-cta)] hover:bg-[var(--color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">
                Sign in as {account.label}
              </span>
              <span className="text-xs font-mono text-[var(--color-text-soft)]">
                {account.email}
              </span>
            </span>
            <span className="block text-xs text-[var(--color-text-soft)] mt-0.5">
              {account.description}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--color-text-soft)] text-center mt-3">
        Sample data. Anything you change here is visible to other visitors.
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `callbackUrl` is what middleware.ts and NextAuth both set; `next` is kept
  // for any older links still pointing here.
  const next = safeRedirectTarget(searchParams.get("callbackUrl") ?? searchParams.get("next"));
  const { toast } = useToast();

  const [showPassword, setShowPassword] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  /**
   * Until React has hydrated, `onSubmit` is not attached and nothing can call
   * `preventDefault`. The form has no `action`, so a submit at that moment is a
   * native GET to this same page — landing the user on
   * `/login?email=…&password=…`, with their password in the URL bar, in browser
   * history, and in every access log along the way, and no session to show for
   * it. Reachable by autofill-then-Enter, or by anyone quick on a slow
   * connection. A disabled default button also suppresses implicit submission
   * via Enter, so this closes the keyboard path too.
   */
  const [isHydrated, setIsHydrated] = React.useState(false);
  React.useEffect(() => setIsHydrated(true), []);

  // Set only when sign-in failed specifically because the address is
  // unverified, so the notice appears for that one case and not for a typo.
  const [unverifiedEmail, setUnverifiedEmail] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [hasResent, setHasResent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  function onSubmit(data: LoginInput) {
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        const isUnverified =
          result.error === "CredentialsSignin" && result.code === "email_not_verified";
        // Drop any notice from a previous attempt — a different address, or a
        // password they have since corrected, should not leave it stranded.
        setUnverifiedEmail(isUnverified ? data.email : null);
        setHasResent(false);
        toast({
          title: "Sign in failed",
          description: describeSignInError(result),
          variant: "destructive",
        });
        return;
      }

      router.push(next);
      router.refresh();
    });
  }

  async function handleResend() {
    if (!unverifiedEmail) return;
    setIsResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const body = await response.json();

      if (!response.ok) {
        toast({
          title: "Couldn't resend",
          // A 429 here is worth showing verbatim: "too many requests" tells the
          // user to wait, where a generic failure would have them keep retrying.
          description:
            body?.error?.message ?? "Something went wrong. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      setHasResent(true);
      toast({
        title: "Verification email sent",
        description: body?.data?.message,
      });
    } catch {
      toast({
        title: "Couldn't resend",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="w-full max-w-sm animate-fade-in">
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-[var(--color-text-soft)]">
            Sign in to your patient account
          </p>
        </div>

        {unverifiedEmail && (
          <ResendVerification
            email={unverifiedEmail}
            isSending={isResending}
            hasSent={hasResent}
            onResend={handleResend}
          />
        )}

        <form
          method="post"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--color-cta)] hover:text-[#005a38] hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
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
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isPending || !isHydrated}
            className="w-full mt-1"
            size="lg"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {isDemoMode() && (
          <DemoSignIn
            isPending={isPending || !isHydrated}
            onPick={(account) => onSubmit({ email: account.email, password: account.password })}
          />
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--color-text-soft)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-[var(--color-cta)] hover:text-[#005a38] hover:underline transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm h-96 rounded-[var(--radius-card)] skeleton-shimmer" />}>
      <LoginForm />
    </Suspense>
  );
}
