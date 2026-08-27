"use server";

import { AppointmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction, type ActionResult } from "@/lib/action-result";
import {
  resolveActor,
  transitionAppointment,
  updateAdminNotes,
} from "@/lib/appointments";
import { requireRole } from "@/lib/auth";
import { MAX_NOTES_LENGTH } from "@/lib/constants";

/**
 * Staff appointment mutations.
 *
 * Every one runs `requireRole('ADMIN', 'DENTIST')` in the action itself, then
 * hands an `Actor` to the state machine — which scopes a DENTIST to their own
 * appointments and enforces the rest of the table. Nothing here writes `status`
 * directly.
 */

const adminNotesSchema = z.string().max(MAX_NOTES_LENGTH).optional();

async function staffActor() {
  const session = await requireRole("ADMIN", "DENTIST");
  return resolveActor(session);
}

function revalidateStaffViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/appointments");
}

export async function confirmAppointment(
  appointmentId: string,
): Promise<ActionResult<null>> {
  return runAction("confirmAppointment", async () => {
    await transitionAppointment({
      appointmentId,
      to: AppointmentStatus.CONFIRMED,
      actor: await staffActor(),
    });
    revalidateStaffViews();
    return null;
  });
}

export async function completeAppointment(
  appointmentId: string,
  adminNotes?: string,
): Promise<ActionResult<null>> {
  return runAction("completeAppointment", async () => {
    await transitionAppointment({
      appointmentId,
      to: AppointmentStatus.COMPLETED,
      actor: await staffActor(),
      adminNotes: adminNotesSchema.parse(adminNotes),
    });
    revalidateStaffViews();
    return null;
  });
}

export async function cancelAppointmentAsStaff(
  appointmentId: string,
  adminNotes?: string,
): Promise<ActionResult<null>> {
  return runAction("cancelAppointmentAsStaff", async () => {
    await transitionAppointment({
      appointmentId,
      to: AppointmentStatus.CANCELLED,
      actor: await staffActor(),
      adminNotes: adminNotesSchema.parse(adminNotes),
    });
    revalidateStaffViews();
    return null;
  });
}

/**
 * Edit internal notes without touching status.
 *
 * A separate action rather than a flag on the others, so a notes edit can never
 * be the thing that accidentally moves an appointment through the machine.
 */
export async function updateAppointmentNotes(
  appointmentId: string,
  notes: string,
): Promise<ActionResult<null>> {
  return runAction("updateAppointmentNotes", async () => {
    await updateAdminNotes(
      await staffActor(),
      appointmentId,
      adminNotesSchema.parse(notes) ?? "",
    );
    revalidateStaffViews();
    return null;
  });
}
