import * as Sentry from "@sentry/nextjs";

import { SENTRY_ENABLED, sharedSentryOptions } from "./sentry.shared";

/**
 * Browser runtime.
 *
 * Only `NEXT_PUBLIC_SENTRY_DSN` is readable here — a bare `SENTRY_DSN` is
 * server-only and would be `undefined` in the bundle, which is the intent:
 * nothing that is not explicitly public should reach the client.
 */
if (SENTRY_ENABLED) {
  Sentry.init({
    ...sharedSentryOptions,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Session replay is off. It would record patients filling in medical notes.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
