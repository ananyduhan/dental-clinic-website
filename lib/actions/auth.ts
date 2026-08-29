"use server";

import { signOut } from "@/lib/auth";

/**
 * Sign the current user out and return them to the landing page.
 *
 * This replaces a plain `<form action="/api/auth/signout" method="POST">`, which
 * was used in three places and did not work: NextAuth v5 requires a `csrfToken`
 * field in that POST body and silently rejects the request without one, leaving
 * the session intact. The button appeared to do nothing.
 *
 * It went unnoticed because the e2e helper signs out by clearing cookies
 * directly, so no test ever pressed the button.
 *
 * Unlike the other actions in this directory it does not return an
 * `ActionResult` — `signOut` redirects, so nothing after it runs.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
