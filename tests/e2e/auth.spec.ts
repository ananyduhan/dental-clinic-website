import { expect, test } from "@playwright/test";

import { PATIENT, prisma, signIn } from "./fixtures";

/**
 * Sign-in and sign-out through the real UI.
 *
 * These press the actual buttons rather than manipulating cookies. That matters:
 * the `signOut` fixture clears cookies directly, so for a long time no test ever
 * pressed a Sign Out button — and both sign-out bugs this app has had (a form
 * POST missing its CSRF token, then a form unmounted by its own dropdown before
 * it could submit) shipped looking exactly like a button that does nothing.
 *
 * The assertion is deliberately "the session is gone", not "we landed on /".
 * Both bugs redirected correctly while leaving the user signed in.
 */

test.afterAll(async () => {
  await prisma.$disconnect();
});

/** @returns true while the browser still holds a NextAuth session cookie. */
async function hasSession(context: {
  cookies: () => Promise<Array<{ name: string }>>;
}) {
  const cookies = await context.cookies();
  return cookies.some((c) => c.name.includes("session-token"));
}

test("a wrong password is reported as a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.waitForSelector('button[type="submit"]:not([disabled])');
  await page.fill("#email", PATIENT.email);
  await page.fill("#password", "DefinitelyNotThePassword1!");
  await page.click('button[type="submit"]');

  // Not "Configuration", which is what NextAuth reports for anything thrown
  // from `authorize` that is not a CredentialsSignin — see lib/auth.ts.
  // `.first()` because the toast also mirrors its text into an aria-live
  // region for screen readers, so the string legitimately matches twice.
  await expect(
    page.getByText("Invalid email or password. Please try again.").first(),
  ).toBeVisible();
  expect(await hasSession(page.context())).toBe(false);
});

test("the sidebar Sign Out ends the session", async ({ page }) => {
  await signIn(page, PATIENT);
  expect(await hasSession(page.context())).toBe(true);

  await page
    .locator('aside form button[type="submit"]', { hasText: "Sign Out" })
    .click();
  await page.waitForURL("**/");

  expect(await hasSession(page.context())).toBe(false);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("the account menu Sign Out ends the session", async ({ page }) => {
  await signIn(page, PATIENT);
  expect(await hasSession(page.context())).toBe(true);

  await page.locator("header button").last().click();
  await page.locator('[role="menuitem"] button[type="submit"]').first().click();
  await page.waitForURL("**/");

  expect(await hasSession(page.context())).toBe(false);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
