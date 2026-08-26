import { NextRequest, NextResponse } from "next/server";
import { registerPatient } from "@/lib/accounts";
import { handleApiError } from "@/lib/errors";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validators/auth";

/**
 * POST /api/auth/register
 *
 * Always returns 201 for a well-formed request, whether or not the address was
 * already taken — see `registerPatient` for why.
 */
export async function POST(req: NextRequest) {
  try {
    // 3 per hour per IP, per docs/security.md.
    await enforceRateLimit("register", clientIpFrom(req.headers));

    const input = registerSchema.parse(await req.json());
    await registerPatient(input);

    return NextResponse.json(
      { data: { message: "Check your email for a verification link." } },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err, { route: "/api/auth/register", method: "POST" });
  }
}
