import { NextRequest, NextResponse } from "next/server";

import { listAppointmentsFor, resolveActor } from "@/lib/appointments";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError } from "@/lib/errors";
import { appointmentFiltersSchema } from "@/lib/validators/appointment";

export const dynamic = "force-dynamic";

/**
 * GET /api/appointments — the caller's own appointments.
 *
 * The scope comes from the session via `resolveActor`, never from a query
 * parameter. That is the IDOR rule from CLAUDE.md: a patient filtering by
 * someone else's id simply cannot express the request.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const actor = await resolveActor(session);
    const filters = appointmentFiltersSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const result = await listAppointmentsFor(actor, filters);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { route: "/api/appointments", method: "GET" });
  }
}
