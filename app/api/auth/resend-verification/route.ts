import { NextRequest, NextResponse } from "next/server";
import { resendVerificationEmail } from "@/lib/accounts";
import { handleApiError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resendVerificationSchema } from "@/lib/validators/auth";

const GENERIC_RESPONSE =
  "If that address needs verifying, we've sent a new link.";

/**
 * POST /api/auth/resend-verification
 *
 * Sign-in rejects an unverified account (see the `email_not_verified` branch in
 * lib/auth.ts). Without this the user is told to check an inbox for a link that
 * may have expired, been deleted, or never arrived — a dead end with no way out
 * but to contact the clinic.
 *
 * Always 200 for a well-formed email, exactly like forgot-password: whether the
 * address exists, is already verified, or is unknown, the response is the same
 * sentence. Anything else would make this an enumeration oracle
 * (docs/security.md).
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = resendVerificationSchema.parse(await req.json());

    // 3 per hour per email — the same limit forgot-password uses, and for the
    // same reason: this endpoint sends mail to an address the caller chose, so
    // keying on the address rather than the IP stops a botnet mailbombing one
    // victim. Enforced after parsing so the key is a validated address, and the
    // 429 is not itself a probe: the limit applies to unknown addresses too.
    await enforceRateLimit("resendVerification", email.trim().toLowerCase());

    await resendVerificationEmail(email);

    return NextResponse.json({ data: { message: GENERIC_RESPONSE } });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/auth/resend-verification",
      method: "POST",
    });
  }
}
