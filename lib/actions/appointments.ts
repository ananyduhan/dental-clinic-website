"use server";

import { AppointmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/action-result";
import {
  createAppointment,
  resolveActor,
  transitionAppointment,
} from "@/lib/appointments";
import { auth } from "@/lib/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAppointmentSchema } from "@/lib/validators/appointment";

/**
 * Patient-facing appointment mutations.
 *
 * Both re-check the role here rather than leaning on middleware: middleware
 * reads the JWT and cannot see a demotion, so a user downgraded from ADMIN to
 * PATIENT still carries an ADMIN token until it expires. `CLAUDE.md` is
 * explicit that the handler does its own check.
 */

export async function bookAppointment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction("bookAppointment", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();
    if (session.user.role !== "PATIENT") {
      throw new ForbiddenError(
        "Staff book on behalf of patients from the admin area",
      );
    }

    // 10 per hour, per docs/security.md. Keyed on the patient rather than the
    // IP: this endpoint is authenticated, and a shared clinic wi-fi should not
    // let one patient exhaust everyone else's allowance.
    await enforceRateLimit("booking", session.user.id);

    const data = createAppointmentSchema.parse(input);

    const appointment = await createAppointment({
      patientId: session.user.id,
      ...data,
    });

    revalidatePath("/appointments");
    revalidatePath("/dashboard");

    return { id: appointment.id };
  });
}

export async function cancelAppointment(
  appointmentId: string,
): Promise<ActionResult<null>> {
  return runAction("cancelAppointment", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    // `resolveActor` scopes the transition: a PATIENT actor can only reach
    // their own appointment, and the 24-hour rule applies to them alone.
    const actor = await resolveActor(session);

    await transitionAppointment({
      appointmentId,
      to: AppointmentStatus.CANCELLED,
      actor,
    });

    revalidatePath("/appointments");
    revalidatePath("/dashboard");

    return null;
  });
}
