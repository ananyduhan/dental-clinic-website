"use client";

import { useEffect } from "react";

/**
 * Initialise Sentry in the browser.
 *
 * `instrumentation.ts` covers the server and edge runtimes, but Next 14 only
 * loads `sentry.client.config.ts` through `withSentryConfig`, which this project
 * does not use. Importing it from a client component mounted in the root layout
 * does the same job.
 *
 * Renders nothing, and the import is dynamic so the SDK is not part of the
 * initial bundle on a page nobody has errored on yet.
 */
export function SentryInit() {
  useEffect(() => {
    void import("../../sentry.client.config");
  }, []);

  return null;
}
