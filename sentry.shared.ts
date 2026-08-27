/**
 * Options shared by the client, server, and edge Sentry runtimes.
 *
 * Kept in one place so a sampling or scrubbing rule cannot drift between the
 * three entry points and leave one of them reporting more than intended.
 */

/** Nothing is sent unless a DSN is configured — see the note in each config. */
export const SENTRY_ENABLED = Boolean(
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
);

export const sharedSentryOptions = {
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",

  // 10% of transactions in production, everything locally. Performance data is
  // useful but this is a clinic booking site, not a system that needs full
  // tracing at cost.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // This app handles patient data. Request bodies, headers and cookies can all
  // carry names, phone numbers, and session tokens.
  sendDefaultPii: false,

  // Local runs report to the console instead of the network.
  enabled: SENTRY_ENABLED && process.env.NODE_ENV !== "test",
} as const;
