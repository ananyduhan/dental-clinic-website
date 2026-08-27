import { AppointmentStatus, Prisma } from "@prisma/client";

import {
  getAvailableSlots,
  getAvailableSlotsAcrossDentists,
} from "@/lib/availability";
import { CLINIC_TIMEZONE, MAX_NOTES_LENGTH } from "@/lib/constants";
import {
  ConflictError,
  NotFoundError,
  SlotNoLongerAvailableError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { clinicTimeToUtc } from "@/lib/slots";

import { appointmentDateFromKey, endTimeFor } from "./time";

/**
 * Appointment creation, with the three defence layers from
 * docs/booking-flow.md, "Race Condition Prevention".
 *
 *   Layer 1  optimistic re-check against the slot generator — cheap, catches
 *            the common case (minutes elapsed between wizard steps), and
 *            guarantees nothing on its own.
 *   Layer 2  a Serializable transaction holding the overlap query and the
 *            insert together. Retried once on a serialization failure.
 *   Layer 3  the partial unique index `appointments_active_slot_unique`, which
 *            catches exact start-time collisions that slip past Layer 2.
 *
 * Layer 2 is the one that actually holds. Layer 3 only sees exact-start
 * collisions, so overlap-only conflicts (09:00-10:00 against 09:30-10:30)
 * depend entirely on it.
 */

export type CreateAppointmentInput = {
  patientId: string;
  serviceId: string;
  /** `null` means "no preference" — the dentist is chosen here, at confirmation. */
  dentistId: string | null;
  /** Clinic-local calendar date, "yyyy-MM-dd". */
  appointmentDate: string;
  /** Clinic-local wall clock, "HH:mm". Never a client-supplied UTC timestamp. */
  startTime: string;
  notes?: string;
  /**
   * Admin bookings on behalf of a walk-in skip the email-verification
   * precondition — see docs/booking-flow.md, "Preconditions".
   */
  bookedByAdmin?: boolean;
  /** Injected for testability. */
  now?: Date;
  timezone?: string;
};

/** Prisma's code for "transaction failed due to a write conflict or deadlock". */
const SERIALIZATION_FAILURE = "P2034";
/** Prisma's code for a unique constraint violation. */
const UNIQUE_VIOLATION = "P2002";

export async function createAppointment(input: CreateAppointmentInput) {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? CLINIC_TIMEZONE;
  const dateKey = input.appointmentDate;

  const startUtc = clinicTimeToUtc(dateKey, input.startTime, timezone);

  const [patient, service] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.patientId },
      select: { id: true, emailVerified: true },
    }),
    prisma.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, durationMinutes: true, isActive: true },
    }),
  ]);

  if (!patient) throw new NotFoundError("Patient not found");
  if (!service) throw new NotFoundError("Service not found");

  // Re-checked here rather than trusted from the wizard: a service can be
  // deactivated while a patient sits on step 3.
  if (!service.isActive) {
    throw new ValidationError(
      "That service is no longer offered. Please choose another.",
    );
  }
  if (!patient.emailVerified && !input.bookedByAdmin) {
    throw new ValidationError(
      "Please verify your email address before booking",
    );
  }
  if (input.notes && input.notes.length > MAX_NOTES_LENGTH) {
    throw new ValidationError(
      `Notes cannot be longer than ${MAX_NOTES_LENGTH} characters`,
    );
  }

  // A slot entirely in the past can only arrive from clock skew or a crafted
  // request — the generator never offers one.
  if (startUtc < now) {
    throw new ValidationError(
      "That time is in the past. Please choose another.",
    );
  }

  const endTime = endTimeFor(
    dateKey,
    input.startTime,
    service.durationMinutes,
    timezone,
  );

  // Layers 1 and, for "no preference", dentist selection.
  const dentistId = input.dentistId
    ? await resolveRequestedDentist(
        { ...input, dentistId: input.dentistId },
        service,
        now,
        timezone,
      )
    : await resolveDentistByLoadBalancing(input, service, now, timezone);

  await assertPatientIsFree(input.patientId, dateKey, input.startTime, endTime);

  logBooking("bookingAttempted", {
    patientId: input.patientId,
    dentistId,
    serviceId: input.serviceId,
    date: dateKey,
    startTime: input.startTime,
  });

  return createWithinSerializableTransaction({
    patientId: input.patientId,
    dentistId,
    serviceId: input.serviceId,
    dateKey,
    startTime: input.startTime,
    endTime,
    notes: input.notes,
  });
}

/** Layer 1 for an explicitly requested dentist. */
async function resolveRequestedDentist(
  input: CreateAppointmentInput & { dentistId: string },
  service: { durationMinutes: number },
  now: Date,
  timezone: string,
): Promise<string> {
  const dentist = await prisma.dentist.findUnique({
    where: { id: input.dentistId },
    select: { id: true, isActive: true },
  });
  if (!dentist) throw new NotFoundError("Dentist not found");
  // A dentist can be deactivated mid-booking, same as a service.
  if (!dentist.isActive) {
    throw new ValidationError(
      "That dentist is no longer available. Please choose another.",
    );
  }

  const slots = await getAvailableSlots({
    dentistId: dentist.id,
    date: appointmentDateFromKey(input.appointmentDate),
    serviceDurationMinutes: service.durationMinutes,
    now,
    timezone,
  });

  if (!slots.some((slot) => slot.startLocal === input.startTime)) {
    logBooking("bookingConflict", {
      layer: "ui",
      dentistId: dentist.id,
      startTime: input.startTime,
    });
    throw new SlotNoLongerAvailableError();
  }

  return dentist.id;
}

/**
 * "No preference": pick the dentist with the fewest appointments that day.
 *
 * Load balancing, with ties broken by dentist id so the choice is deterministic
 * and a retry of the same request lands on the same dentist.
 */
async function resolveDentistByLoadBalancing(
  input: CreateAppointmentInput,
  service: { durationMinutes: number },
  now: Date,
  timezone: string,
): Promise<string> {
  const day = appointmentDateFromKey(input.appointmentDate);

  const slots = await getAvailableSlotsAcrossDentists({
    date: day,
    serviceDurationMinutes: service.durationMinutes,
    now,
    timezone,
  });

  const slot = slots.find(
    (candidate) => candidate.startLocal === input.startTime,
  );
  if (!slot || slot.dentistIds.length === 0) {
    logBooking("bookingConflict", {
      layer: "ui",
      dentistId: null,
      startTime: input.startTime,
    });
    throw new SlotNoLongerAvailableError();
  }

  const loads = await prisma.appointment.groupBy({
    by: ["dentistId"],
    where: {
      dentistId: { in: slot.dentistIds },
      appointmentDate: day,
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    },
    _count: { _all: true },
  });

  const countFor = new Map(
    loads.map((row) => [row.dentistId, row._count._all]),
  );

  return [...slot.dentistIds].sort((a, b) => {
    const difference = (countFor.get(a) ?? 0) - (countFor.get(b) ?? 0);
    return difference !== 0 ? difference : a.localeCompare(b);
  })[0];
}

/**
 * A patient cannot hold two appointments at once, even with different dentists.
 *
 * docs/booking-flow.md files this under `createAppointmentSchema` refinement,
 * but it needs a database read, so Zod cannot express it — it lives here
 * instead, where every caller goes through it.
 */
async function assertPatientIsFree(
  patientId: string,
  dateKey: string,
  startTime: string,
  endTime: string,
): Promise<void> {
  const clash = await prisma.appointment.findFirst({
    where: {
      patientId,
      appointmentDate: appointmentDateFromKey(dateKey),
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true },
  });

  if (clash) {
    throw new ConflictError(
      "You already have an appointment booked at that time",
    );
  }
}

/**
 * Layers 2 and 3.
 *
 * Serializable isolation makes Postgres detect the concurrent conflicting write
 * and fail one of the transactions; that one is retried once, and a second
 * failure surfaces as a conflict rather than spinning.
 */
async function createWithinSerializableTransaction(data: {
  patientId: string;
  dentistId: string;
  serviceId: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  notes?: string;
}) {
  const appointmentDate = appointmentDateFromKey(data.dateKey);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const overlap = await tx.appointment.findFirst({
            where: {
              dentistId: data.dentistId,
              appointmentDate,
              status: {
                in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
              },
              // Half-open overlap on clinic-local wall clock. "HH:mm" is
              // zero-padded 24-hour, so string ordering is ordinal, and this
              // matches the column ordering the partial index relies on.
              startTime: { lt: data.endTime },
              endTime: { gt: data.startTime },
            },
            select: { id: true },
          });

          if (overlap) {
            logBooking("bookingConflict", { layer: "tx", ...data });
            throw new ConflictError(
              "That time has just been booked. Please choose another.",
            );
          }

          return tx.appointment.create({
            data: {
              patientId: data.patientId,
              dentistId: data.dentistId,
              serviceId: data.serviceId,
              appointmentDate,
              startTime: data.startTime,
              endTime: data.endTime,
              notes: data.notes,
              status: AppointmentStatus.PENDING,
            },
            include: {
              patient: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              dentist: {
                include: {
                  user: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
              service: true,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // Layer 3 fired: the index caught an exact start-time collision that the
      // overlap query missed. Not retryable — the slot is genuinely taken.
      if (isPrismaCode(error, UNIQUE_VIOLATION)) {
        logBooking("bookingConflict", { layer: "index", ...data });
        throw new ConflictError(
          "That time has just been booked. Please choose another.",
        );
      }

      if (isPrismaCode(error, SERIALIZATION_FAILURE) && attempt === 0) {
        logBooking("bookingConflict", { layer: "tx", retrying: true, ...data });
        continue;
      }

      if (isPrismaCode(error, SERIALIZATION_FAILURE)) {
        throw new ConflictError(
          "That time has just been booked. Please choose another.",
        );
      }

      throw error;
    }
  }

  // Unreachable: the loop either returns or throws on both attempts.
  throw new ConflictError(
    "That time has just been booked. Please choose another.",
  );
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
}

/**
 * Structured booking logs, per docs/booking-flow.md, "Observability".
 *
 * Console for now; Phase 6 points these at Sentry breadcrumbs alongside the
 * rest of the instrumentation.
 */
function logBooking(event: string, fields: Record<string, unknown>): void {
  console.info(`[booking] ${event}`, fields);
}
