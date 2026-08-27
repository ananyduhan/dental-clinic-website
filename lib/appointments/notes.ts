import { prisma } from "@/lib/prisma";

import { getAppointmentFor } from "./queries";
import type { Actor } from "./transition";

/**
 * Staff-only internal notes.
 *
 * Separate from `transition.ts` because it does not touch `status` — that
 * column has exactly one writer, and adding a second entry point to it here
 * would quietly undo the guarantee.
 *
 * The scoped read runs first so a dentist cannot annotate an appointment that
 * is not theirs; it throws NotFound before the update is reached.
 */
export async function updateAdminNotes(
  actor: Actor,
  appointmentId: string,
  notes: string,
) {
  await getAppointmentFor(actor, appointmentId);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { adminNotes: notes },
  });

  return getAppointmentFor(actor, appointmentId);
}
