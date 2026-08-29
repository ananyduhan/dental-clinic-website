/**
 * Demo mode — what makes the public deployment usable by a stranger.
 *
 * This app is deployed as a portfolio piece, so anyone who lands on it has to be
 * able to exercise the whole product without a clinic ever emailing them. Two
 * things stand in the way, and this module addresses both:
 *
 * 1. **Registration requires a verified email address**, and verification
 *    requires a mail provider that can reach an arbitrary recipient. Resend
 *    cannot do that without a domain you control, so on a `*.vercel.app` URL
 *    there is no way to deliver the link. In demo mode a new account is created
 *    already verified and no email is sent.
 *
 * 2. **Registration only ever creates a `PATIENT`.** The admin and dentist
 *    dashboards are unreachable by signing up, so the demo credentials below are
 *    the only way to see them.
 *
 * Turning `NEXT_PUBLIC_DEMO_MODE` off restores the real behaviour exactly — the
 * verification flow in `lib/accounts.ts` is untouched and still the default.
 * Nothing here weakens password hashing, authorisation, or IDOR scoping.
 */

/**
 * Read at call time rather than module scope so tests can toggle it, and so a
 * server render picks up the current value rather than one frozen at import.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export type DemoAccount = {
  label: string;
  description: string;
  email: string;
  password: string;
};

/**
 * The seeded accounts from `prisma/seed.ts`. Deliberately public — they are
 * printed on the sign-in page — so they are sample data, not secrets. Keep them
 * in step with the seed script.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    label: "Patient",
    description: "Book, view, and cancel your own appointments",
    email: "patient1@demo.com",
    password: "Patient123!",
  },
  {
    label: "Admin",
    description: "Manage appointments, dentists, services, and exports",
    email: "admin@demo.com",
    password: "AdminDemo123!",
  },
];
