import { NextRequest, NextResponse } from "next/server";

import {
  getAppointmentFor,
  resolveActor,
  transitionAppointment,
} from "@/lib/appointments";
import { auth } from "@/lib/auth";
import { handleApiError, UnauthorizedError } from "@/lib/errors";
import { updateAppointmentPatientSchema } from "@/lib/validators/appointment";

export const dynamic = "force-dynamic";

/** GET /api/appointments/:id — scoped to the caller. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const actor = await resolveActor(session);
    return NextResponse.json({
      data: await getAppointmentFor(actor, params.id),
    });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/appointments/[id]",
      method: "GET",
    });
  }
}

/**
 * PATCH /api/appointments/:id — cancel.
 *
 * The only transition a patient may request. `transitionAppointment` decides
 * whether they are allowed to, including the 24-hour rule, and scopes the
 * lookup to them: another patient's id resolves to NotFound.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const actor = await resolveActor(session);
    const { status } = updateAppointmentPatientSchema.parse(await req.json());

    const appointment = await transitionAppointment({
      appointmentId: params.id,
      to: status,
      actor,
    });

    return NextResponse.json({ data: appointment });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/appointments/[id]",
      method: "PATCH",
    });
  }
}
