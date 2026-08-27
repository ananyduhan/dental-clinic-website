/**
 * Next.js instrumentation hook.
 *
 * This is how Sentry is initialised on the server and edge runtimes without
 * `withSentryConfig`. The wrapper exists to inject the SDK through webpack, but
 * it also re-bundles `@sentry/nextjs` — which `next.config.mjs` deliberately
 * keeps external to avoid the OpenTelemetry "Critical dependency" warning.
 * Importing the configs here achieves the same initialisation and leaves the
 * build clean.
 *
 * The trade-off: no automatic source-map upload. Add `SENTRY_AUTH_TOKEN`,
 * `SENTRY_ORG` and `SENTRY_PROJECT` and wire `withSentryConfig` if readable
 * stack traces in production become worth the build complexity.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
