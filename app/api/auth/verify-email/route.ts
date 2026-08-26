import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/lib/accounts";
import { handleApiError } from "@/lib/errors";

/**
 * Reads `searchParams`, so it can never be statically rendered. Declaring that
 * up front keeps `next build` from attempting a prerender and logging a
 * "Dynamic server usage" error for a route that is working as intended.
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/verify-email?token=…
 *
 * The target of the link in the verification email, so it is followed by a
 * browser and must answer with a redirect rather than JSON. Outcome is passed to
 * /verify-email as a status param, which renders the human-readable result.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const destination = new URL("/verify-email", req.nextUrl.origin);

    if (!token) {
      destination.searchParams.set("status", "invalid");
      return NextResponse.redirect(destination);
    }

    destination.searchParams.set("status", await verifyEmail(token));
    return NextResponse.redirect(destination);
  } catch (err) {
    return handleApiError(err, { route: "/api/auth/verify-email", method: "GET" });
  }
}
