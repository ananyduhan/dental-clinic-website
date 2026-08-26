import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import {
  authConfig,
  defaultLandingFor,
  isAuthPage,
  isProtectedPath,
  isStaffPath,
} from "@/lib/auth.config";
import type { Role } from "@prisma/client";

/**
 * Session gate for the (patient) and (admin) route groups.
 *
 * This is a first pass only — it keeps unauthenticated users out of the app
 * shell and gives them a clean redirect instead of a flash of empty UI. It is
 * NOT the authorization boundary.
 *
 * Per CLAUDE.md: "Role check in every server action and API route — middleware
 * is not enough." Middleware sees only the JWT, which is issued at login and can
 * be stale: a user demoted from ADMIN to PATIENT keeps an ADMIN token until it
 * expires. Every handler must re-check against the database.
 *
 * Runs on the edge runtime, so it uses lib/auth.config.ts (pure) rather than
 * lib/auth.ts (imports Prisma and bcrypt, Node-only).
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const user = req.auth?.user;
  const isLoggedIn = Boolean(user);

  // Signed-in users have no use for the login/register pages.
  if (isLoggedIn && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL(defaultLandingFor(user?.role as Role | undefined), req.nextUrl));
  }

  if (!isProtectedPath(pathname)) return NextResponse.next();

  if (!isLoggedIn) {
    // Preserve where they were heading so login can bounce them back.
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Patients never see the admin surface. Staff may use patient routes (an admin
  // booking on their own behalf is legitimate), so this check is one-directional.
  if (isStaffPath(pathname) && (user?.role as Role) === "PATIENT") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  /**
   * Skip Next internals, the auth API (it must stay reachable to sign anyone
   * in), and anything with a file extension. Everything else passes through.
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
