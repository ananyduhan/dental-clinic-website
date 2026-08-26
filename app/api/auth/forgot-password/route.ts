import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/accounts";
import { handleApiError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validators/auth";

const GENERIC_RESPONSE = "If an account exists for that address, we've sent a reset link.";

/**
 * POST /api/auth/forgot-password
 *
 * Always 200 for a well-formed email, existing account or not. Anything else
 * turns this endpoint into an account-enumeration oracle (docs/security.md).
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = forgotPasswordSchema.parse(await req.json());

    // 3 per hour per email, per docs/security.md — keyed on the address rather
    // than the IP so one attacker cannot mailbomb a victim from a botnet.
    // Rate-limited *after* parsing so the key is a validated address, and the
    // limit itself is not a way to probe which addresses exist: the response is
    // identical either way.
    await enforceRateLimit("forgotPassword", email.trim().toLowerCase());

    await requestPasswordReset(email);

    return NextResponse.json({ data: { message: GENERIC_RESPONSE } });
  } catch (err) {
    return handleApiError(err, { route: "/api/auth/forgot-password", method: "POST" });
  }
}
