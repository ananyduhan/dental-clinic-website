import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe half of the NextAuth configuration.
 *
 * `middleware.ts` runs on the edge runtime, where Prisma Client cannot run. So
 * the config is split: everything here is pure (no DB, no bcrypt, no Node
 * built-ins) and is what middleware instantiates. `lib/auth.ts` spreads this and
 * adds the Credentials provider, which does touch Prisma and bcrypt, and is used
 * only from Node contexts (route handlers, server components, server actions).
 *
 * Only `@prisma/client` *types* are imported here — types are erased at compile
 * time and never reach the edge bundle.
 *
 * If you add a provider that needs the database, it belongs in `lib/auth.ts`,
 * not here.
 */

/** Route prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/book",
  "/appointments",
  "/profile",
  "/admin",
] as const;

/** Staff-only prefixes — PATIENT sessions are bounced to their own dashboard. */
const STAFF_PREFIXES = ["/admin"] as const;

/** Signed-in users have no business on these; send them to their landing page. */
const AUTH_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isStaffPath(pathname: string): boolean {
  return STAFF_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p);
}

/** Where a signed-in user belongs when they land somewhere they shouldn't be. */
export function defaultLandingFor(role: Role | undefined): string {
  return role === "ADMIN" || role === "DENTIST" ? "/admin" : "/dashboard";
}

export const authConfig = {
  /**
   * Trust the Host header.
   *
   * NextAuth v5 refuses any request whose host it cannot verify, and outside
   * development it only auto-trusts when it detects Vercel. Without this a
   * production build answers every auth request with `UntrustedHost` and a 500
   * — which is exactly what `pnpm start` and the e2e suite hit.
   *
   * Safe here because the app runs behind Vercel's proxy, which sets
   * `X-Forwarded-Host` itself and does not pass through a client-supplied one.
   * Revisit if this is ever deployed behind a proxy that does not.
   */
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Providers are added in lib/auth.ts. Middleware only ever verifies an
  // already-issued JWT, so it needs no provider to do its job.
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.firstName = (user as { firstName: string }).firstName;
        token.lastName = (user as { lastName: string }).lastName;
        token.isEmailVerified = (
          user as { isEmailVerified: boolean }
        ).isEmailVerified;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.firstName = token.firstName as string;
      session.user.lastName = token.lastName as string;
      session.user.isEmailVerified = token.isEmailVerified as boolean;
      return session;
    },
  },
} satisfies NextAuthConfig;
