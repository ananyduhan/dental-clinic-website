import * as Sentry from "@sentry/nextjs";

import { SENTRY_ENABLED, sharedSentryOptions } from "./sentry.shared";

/**
 * Edge runtime — `middleware.ts` and anything else marked `runtime: "edge"`.
 *
 * Deliberately minimal: the edge bundle is size-constrained, and middleware is
 * a session gate that does nothing more interesting than read a JWT.
 */
if (SENTRY_ENABLED) {
  Sentry.init({
    ...sharedSentryOptions,
    // The edge runtime has no tracing worth the bytes here.
    tracesSampleRate: 0,
  });
}
