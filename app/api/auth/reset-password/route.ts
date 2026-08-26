import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/accounts";
import { handleApiError } from "@/lib/errors";
import { clientIpFrom, enforceRateLimit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validators/auth";

/**
 * POST /api/auth/reset-password
 *
 * Unlike forgot-password this reports failure, because the user is holding a
 * link they believe works and needs to know it has expired. The messages still
 * say nothing about which addresses have accounts.
 */
export async function POST(req: NextRequest) {
  try {
    // 5 per hour per IP — this endpoint accepts a token, so an unthrottled
    // version is a place to guess them.
    await enforceRateLimit("resetPassword", clientIpFrom(req.headers));

    const { token, password } = resetPasswordSchema.parse(await req.json());
    await resetPassword(token, password);

    return NextResponse.json({
      data: { message: "Your password has been reset. You can now sign in." },
    });
  } catch (err) {
    return handleApiError(err, { route: "/api/auth/reset-password", method: "POST" });
  }
}
