import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailWarning, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify Email" };

/**
 * Where /api/auth/verify-email redirects after consuming a token, and where
 * unverified patients are sent when they try to book (docs/booking-flow.md).
 *
 * Purely presentational — the token was already consumed by the API route. This
 * page only renders the outcome, so a refresh cannot double-verify or leak a
 * token into the browser history of the page itself.
 */

type Status = "verified" | "already-verified" | "invalid" | "pending";

const STATES: Record<
  Status,
  {
    icon: typeof CheckCircle2;
    iconClass: string;
    ringClass: string;
    title: string;
    body: string;
    cta: { href: string; label: string };
  }
> = {
  verified: {
    icon: CheckCircle2,
    iconClass: "text-[var(--color-cta)]",
    ringClass: "bg-[var(--color-valid-tint)]",
    title: "Email verified",
    body: "Your address is confirmed. You can sign in and book your first appointment.",
    cta: { href: "/login", label: "Go to Sign In" },
  },
  "already-verified": {
    icon: CheckCircle2,
    iconClass: "text-[var(--color-cta)]",
    ringClass: "bg-[var(--color-valid-tint)]",
    title: "Already verified",
    body: "This address was verified previously. Nothing more to do — just sign in.",
    cta: { href: "/login", label: "Go to Sign In" },
  },
  invalid: {
    icon: XCircle,
    iconClass: "text-[var(--color-error)]",
    ringClass: "bg-[var(--color-error-tint)]",
    title: "Link expired or invalid",
    body:
      "Verification links last 24 hours and can only be used once. Register again with the same address and we'll send a fresh link.",
    cta: { href: "/register", label: "Request a new link" },
  },
  pending: {
    icon: MailWarning,
    iconClass: "text-[var(--color-cta)]",
    ringClass: "bg-[var(--color-green-light)]",
    title: "Check your inbox",
    body:
      "You need to verify your email address before booking. Open the link we sent you — it's valid for 24 hours.",
    cta: { href: "/login", label: "Back to Sign In" },
  },
};

function toStatus(value: string | string[] | undefined): Status {
  const key = Array.isArray(value) ? value[0] : value;
  return key && key in STATES ? (key as Status) : "pending";
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { status?: string | string[] };
}) {
  const state = STATES[toStatus(searchParams.status)];
  const Icon = state.icon;

  return (
    <div className="w-full max-w-sm animate-fade-in text-center">
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-8">
        <div className={`h-16 w-16 rounded-full ${state.ringClass} flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`h-8 w-8 ${state.iconClass}`} aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-[var(--color-feature)] mb-2">{state.title}</h1>
        <p className="text-sm text-[var(--color-text-soft)] mb-6">{state.body}</p>

        <Link href={state.cta.href}>
          <Button className="w-full">{state.cta.label}</Button>
        </Link>
      </div>
    </div>
  );
}
