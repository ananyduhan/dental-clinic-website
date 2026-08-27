import { AppointmentStatus } from "@prisma/client";

import { CLINIC_TIMEZONE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  clinicDateKey,
  clinicTimeToUtc,
  generateSlots,
  type BookedInterval,
  type Slot,
} from "@/lib/slots";

/**
 * The seam between I/O and slot logic.
 *
 * Everything here fetches; nothing here decides. All of the arithmetic lives in
 * `lib/slots.ts` as pure functions so it stays unit-testable without a database.
 */

/** Statuses that occupy a slot. CANCELLED and COMPLETED do not block. */
const ACTIVE_STATUSES = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

export type AvailableSlotsQuery = {
  dentistId: string;
  /** UTC midnight of the clinic-local calendar date the patient picked. */
  date: Date;
  /**
   * Caller resolves this from the service. It is not looked up here because
   * every caller must check `service.isActive` anyway — see the edge case table
   * in docs/booking-flow.md.
   */
  serviceDurationMinutes: number;
  /** Injected for testability; defaults to the current instant. */
  now?: Date;
  timezone?: string;
};

/** A slot tagged with every active dentist who could fill it. */
export type SlotWithDentists = Slot & { dentistIds: string[] };

/** Slots for one specific dentist on one day. */
export async function getAvailableSlots(
  query: AvailableSlotsQuery,
): Promise<Slot[]> {
  const { dentistId, date, serviceDurationMinutes } = query;
  const timezone = query.timezone ?? CLINIC_TIMEZONE;
  const now = query.now ?? new Date();

  const dateKey = clinicDateKey(date);
  const day = dayFromKey(dateKey);

  const [availability, blockedDates, appointments] = await Promise.all([
    prisma.availability.findMany({
      where: { dentistId },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isActive: true,
      },
    }),
    prisma.blockedDate.findMany({
      where: { dentistId, date: day },
      select: { date: true },
    }),
    prisma.appointment.findMany({
      where: {
        dentistId,
        appointmentDate: day,
        status: { in: ACTIVE_STATUSES },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  return generateSlots({
    date: day,
    serviceDurationMinutes,
    availability,
    blockedDates,
    existingAppointments: appointments.map((appointment) =>
      toInterval(dateKey, appointment, timezone),
    ),
    now,
    timezone,
  });
}

/**
 * Slots across every active dentist, for the "No preference" path.
 *
 * Step 3 of the wizard shows the union; the dentist is only picked at
 * confirmation time, so each slot carries the IDs that can fill it. Three
 * queries total — the per-dentist generation then runs in memory.
 */
export async function getAvailableSlotsAcrossDentists(
  query: Omit<AvailableSlotsQuery, "dentistId">,
): Promise<SlotWithDentists[]> {
  const { date, serviceDurationMinutes } = query;
  const timezone = query.timezone ?? CLINIC_TIMEZONE;
  const now = query.now ?? new Date();

  const dateKey = clinicDateKey(date);
  const day = dayFromKey(dateKey);

  const dentists = await prisma.dentist.findMany({
    where: { isActive: true },
    select: {
      id: true,
      availability: {
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          isActive: true,
        },
      },
    },
  });
  if (dentists.length === 0) return [];

  const dentistIds = dentists.map((dentist) => dentist.id);

  const [blockedDates, appointments] = await Promise.all([
    prisma.blockedDate.findMany({
      where: { dentistId: { in: dentistIds }, date: day },
      select: { dentistId: true, date: true },
    }),
    prisma.appointment.findMany({
      where: {
        dentistId: { in: dentistIds },
        appointmentDate: day,
        status: { in: ACTIVE_STATUSES },
      },
      select: { dentistId: true, startTime: true, endTime: true },
    }),
  ]);

  // Preserve first-seen order by keying on the instant; slots are generated in
  // ascending order per dentist, and the map is re-sorted at the end anyway.
  const byInstant = new Map<string, SlotWithDentists>();

  for (const dentist of dentists) {
    const slots = generateSlots({
      date: day,
      serviceDurationMinutes,
      availability: dentist.availability,
      blockedDates: blockedDates.filter(
        (blocked) => blocked.dentistId === dentist.id,
      ),
      existingAppointments: appointments
        .filter((appointment) => appointment.dentistId === dentist.id)
        .map((appointment) => toInterval(dateKey, appointment, timezone)),
      now,
      timezone,
    });

    for (const slot of slots) {
      const key = slot.startUtc.toISOString();
      const existing = byInstant.get(key);
      if (existing) {
        existing.dentistIds.push(dentist.id);
      } else {
        byInstant.set(key, { ...slot, dentistIds: [dentist.id] });
      }
    }
  }

  return Array.from(byInstant.values()).sort(
    (a, b) => a.startUtc.getTime() - b.startUtc.getTime(),
  );
}

/**
 * Normalise to the UTC-midnight `Date` Prisma expects for a `@db.Date` column,
 * so a caller passing a mid-day instant still matches the right row.
 */
function dayFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * An appointment's stored (date, "HH:mm", "HH:mm") is clinic-local wall clock.
 * Converting through the same helper the generator uses keeps the two sides of
 * the overlap test on one timeline.
 */
function toInterval(
  dateKey: string,
  appointment: { startTime: string; endTime: string },
  timezone: string,
): BookedInterval {
  return {
    startUtc: clinicTimeToUtc(dateKey, appointment.startTime, timezone),
    endUtc: clinicTimeToUtc(dateKey, appointment.endTime, timezone),
  };
}
