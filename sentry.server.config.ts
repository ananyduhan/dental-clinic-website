import * as Sentry from "@sentry/nextjs";

import { SENTRY_ENABLED, sharedSentryOptions } from "./sentry.shared";

/**
 * Node runtime — route handlers, Server Actions, server components, the cron
 * sweep. Loaded from `instrumentation.ts`.
 *
 * `Sentry.init` with no DSN is a no-op, but skipping the call entirely keeps
 * the OpenTelemetry instrumentation from being installed at all on a deploy
 * that has not configured error tracking.
 */
if (SENTRY_ENABLED) {
  Sentry.init({
    ...sharedSentryOptions,
    // The reminder sweep logs its own outcomes; the breadcrumb duplicates them.
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== "Console"),
  });
}
