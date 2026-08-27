import { AppointmentStatus } from "@prisma/client";

import { CANCELLATION_WINDOW_MS } from "@/lib/constants";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import { appointmentInterval, type StoredAppointmentTime } from "./time";

/**
 * The appointment state machine.
 *
 * This is the ONLY code path that writes `status`. Route handlers and server
 * actions call `transitionAppointment` — they never set the column directly,
 * because every rule about who may do what, and when, lives here.
 *
 * See docs/booking-flow.md, "Appointment State Machine".
 */

/**
 * Who is attempting the transition.
 *
 * A DENTIST actor carries their `Dentist.id` as well as their user id: the
 * session only knows the latter, but every dentist rule is scoped to *their
 * own* appointments and `appointments.dentist_id` points at the former.
 */
export type Actor =
  | { role: "PATIENT"; userId: string }
  | { role: "ADMIN"; userId: string }
  | { role: "DENTIST"; userId: string; dentistId: string };

/** The fields the state machine needs to reach a verdict. */
export type TransitionableAppointment = StoredAppointmentTime & {
  id: string;
  patientId: string;
  dentistId: string;
  status: AppointmentStatus;
};

export type TransitionInput = {
  appointment: TransitionableAppointment;
  to: AppointmentStatus;
  actor: Actor;
  /** Injected so the 24-hour rule is testable. */
  now: Date;
  timezone?: string;
};

const TERMINAL_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.COMPLETED,
];

/** Every legal edge in the machine. Anything absent here is rejected. */
const LEGAL_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.PENDING]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.COMPLETED]: [],
};

/**
 * Decide whether a transition is allowed. Pure — throws, or returns nothing.
 *
 * Kept free of I/O so every branch of the table is unit-testable without a
 * database, which matters because this is where authorization actually happens.
 */
export function assertTransitionAllowed(input: TransitionInput): void {
  const { appointment, to, actor, now, timezone } = input;

  assertActorMayTouch(appointment, actor);

  if (TERMINAL_STATUSES.includes(appointment.status)) {
    throw new ValidationError(
      `This appointment is ${appointment.status.toLowerCase()} and can no longer be changed`,
    );
  }

  if (appointment.status === to) {
    throw new ValidationError(
      `This appointment is already ${to.toLowerCase()}`,
    );
  }

  if (!LEGAL_TRANSITIONS[appointment.status].includes(to)) {
    throw new ValidationError(
      `Cannot change an appointment from ${appointment.status.toLowerCase()} to ${to.toLowerCase()}`,
    );
  }

  switch (to) {
    case AppointmentStatus.CONFIRMED:
      // Staff only. A patient confirming their own booking would defeat the
      // point of the clinic reviewing it.
      if (actor.role === "PATIENT") {
        throw new ForbiddenError("Only the clinic can confirm an appointment");
      }
      return;

    case AppointmentStatus.COMPLETED: {
      if (actor.role === "PATIENT") {
        throw new ForbiddenError(
          "Only the clinic can mark an appointment complete",
        );
      }
      // "Only allowed after appointment_date + end_time has passed."
      const { endUtc } = appointmentInterval(appointment, timezone);
      if (endUtc > now) {
        throw new ValidationError("This appointment has not finished yet");
      }
      return;
    }

    case AppointmentStatus.CANCELLED:
      // Admins and dentists can always cancel; patients are held to the
      // 24-hour rule. Exactly 24h is a rejection — no fuzz factor.
      if (actor.role === "PATIENT") {
        const { startUtc } = appointmentInterval(appointment, timezone);
        if (startUtc.getTime() - now.getTime() <= CANCELLATION_WINDOW_MS) {
          throw new ValidationError(
            "Appointments can only be cancelled more than 24 hours in advance. " +
              "Please call the clinic to cancel.",
          );
        }
      }
      return;

    default:
      throw new ValidationError(`Unsupported target status: ${to}`);
  }
}

/**
 * Whether this actor is allowed to act on this appointment at all.
 *
 * Deliberately checked before the state rules so that probing a stranger's
 * appointment cannot be distinguished from probing a nonexistent one by the
 * error it returns.
 */
function assertActorMayTouch(
  appointment: TransitionableAppointment,
  actor: Actor,
): void {
  switch (actor.role) {
    case "ADMIN":
      return;
    case "PATIENT":
      if (appointment.patientId !== actor.userId)
        throw new NotFoundError("Appointment not found");
      return;
    case "DENTIST":
      if (appointment.dentistId !== actor.dentistId) {
        throw new NotFoundError("Appointment not found");
      }
      return;
  }
}

/**
 * Load, check, and write — the single entry point for a status change.
 *
 * The read and the write share one transaction, and the write re-asserts the
 * status it expected to find. Two admins clicking Confirm and Cancel at the
 * same moment therefore cannot both succeed: the second `updateMany` matches
 * zero rows and is rejected rather than silently overwriting the first.
 */
export async function transitionAppointment(input: {
  appointmentId: string;
  to: AppointmentStatus;
  actor: Actor;
  adminNotes?: string;
  now?: Date;
  timezone?: string;
}) {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      select: {
        id: true,
        patientId: true,
        dentistId: true,
        status: true,
        appointmentDate: true,
        startTime: true,
        endTime: true,
      },
    });
    if (!appointment) throw new NotFoundError("Appointment not found");

    assertTransitionAllowed({
      appointment,
      to: input.to,
      actor: input.actor,
      now,
      timezone: input.timezone,
    });

    const updated = await tx.appointment.updateMany({
      // The status guard makes this a compare-and-swap.
      where: { id: appointment.id, status: appointment.status },
      data: {
        status: input.to,
        ...(input.adminNotes !== undefined
          ? { adminNotes: input.adminNotes }
          : {}),
      },
    });

    if (updated.count === 0) {
      throw new ValidationError(
        "This appointment was just changed by someone else",
      );
    }

    return tx.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        dentist: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        service: true,
      },
    });
  });
}
