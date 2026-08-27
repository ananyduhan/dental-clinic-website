import { NextRequest, NextResponse } from "next/server";

import {
  resolveActor,
  transitionAppointment,
  updateAdminNotes,
} from "@/lib/appointments";
import { requireRole } from "@/lib/auth";
import { handleApiError, ValidationError } from "@/lib/errors";
import { updateAppointmentAdminSchema } from "@/lib/validators/appointment";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/appointments/:id — status change and/or admin notes. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRole("ADMIN", "DENTIST");
    const actor = await resolveActor(session);

    const { status, adminNotes } = updateAppointmentAdminSchema.parse(
      await req.json(),
    );

    if (!status && adminNotes === undefined) {
      throw new ValidationError("Nothing to update");
    }

    // A status change always goes through the state machine, which is the only
    // code permitted to write the column. A notes-only edit does not.
    if (status) {
      const appointment = await transitionAppointment({
        appointmentId: params.id,
        to: status,
        actor,
        adminNotes,
      });
      return NextResponse.json({ data: appointment });
    }

    // Notes-only edit. `updateAdminNotes` does the scoped read first, so a
    // dentist cannot annotate an appointment that is not theirs.
    return NextResponse.json({
      data: await updateAdminNotes(actor, params.id, adminNotes ?? ""),
    });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/admin/appointments/[id]",
      method: "PATCH",
    });
  }
}
