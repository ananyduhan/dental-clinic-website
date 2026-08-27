import { NextRequest, NextResponse } from "next/server";

import { listAppointmentsFor, resolveActor } from "@/lib/appointments";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { appointmentFiltersSchema } from "@/lib/validators/appointment";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/appointments
 *
 * `requireRole` runs here, in the handler — middleware reads the JWT and cannot
 * see a role that was revoked after the token was issued. A DENTIST actor is
 * scoped by `listAppointmentsFor` to their own appointments; only an ADMIN sees
 * everything, and only an ADMIN can filter by `dentistId`.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN", "DENTIST");
    const actor = await resolveActor(session);

    const filters = appointmentFiltersSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    return NextResponse.json(await listAppointmentsFor(actor, filters));
  } catch (err) {
    return handleApiError(err, {
      route: "/api/admin/appointments",
      method: "GET",
    });
  }
}
