import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError } from "@/lib/errors";
import { getProfile, updateProfile } from "@/lib/profile";
import { updateProfileSchema } from "@/lib/validators/profile";

export const dynamic = "force-dynamic";

/** GET /api/patient/profile — always the caller's own. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    return NextResponse.json({ data: await getProfile(session.user.id) });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/patient/profile",
      method: "GET",
    });
  }
}

/**
 * PATCH /api/patient/profile
 *
 * The id comes from the session, never the body — there is no way to express
 * an update to somebody else's profile.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const input = updateProfileSchema.parse(await req.json());
    return NextResponse.json({
      data: await updateProfile(session.user.id, input),
    });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/patient/profile",
      method: "PATCH",
    });
  }
}
