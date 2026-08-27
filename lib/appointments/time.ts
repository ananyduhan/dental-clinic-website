import { addMinutes } from "date-fns";

import { CLINIC_TIMEZONE } from "@/lib/constants";
import { clinicDateKey, clinicTimeToUtc, utcToClinicTime } from "@/lib/slots";

/**
 * Converting an appointment row between its stored form and the absolute
 * timeline.
 *
 * An appointment is persisted as `(appointment_date, "HH:mm", "HH:mm")` in
 * clinic-local wall clock. Every rule that compares it to *now* — the 24-hour
 * cancellation window, the "has the visit happened yet" check, the reminder
 * sweep — has to happen on the absolute timeline, so it goes through here.
 */

/** The stored shape, as read from Prisma. */
export type StoredAppointmentTime = {
  appointmentDate: Date;
  startTime: string;
  endTime: string;
};

export type AppointmentInterval = {
  startUtc: Date;
  endUtc: Date;
};

/** The instants an appointment actually occupies. */
export function appointmentInterval(
  appointment: StoredAppointmentTime,
  timezone: string = CLINIC_TIMEZONE,
): AppointmentInterval {
  const dateKey = clinicDateKey(appointment.appointmentDate);
  return {
    startUtc: clinicTimeToUtc(dateKey, appointment.startTime, timezone),
    endUtc: clinicTimeToUtc(dateKey, appointment.endTime, timezone),
  };
}

/**
 * The end of a service starting at `startTime`, as clinic-local "HH:mm".
 *
 * Derived by adding the duration on the *absolute* timeline and converting
 * back, not by adding minutes to the wall clock. Across a DST spring-forward a
 * 30-minute service starting 01:45 legitimately ends at 03:15 — 30 real
 * minutes of the dentist's time, 90 minutes of clock.
 */
export function endTimeFor(
  dateKey: string,
  startTime: string,
  durationMinutes: number,
  timezone: string = CLINIC_TIMEZONE,
): string {
  const startUtc = clinicTimeToUtc(dateKey, startTime, timezone);
  return utcToClinicTime(addMinutes(startUtc, durationMinutes), timezone);
}

/**
 * Normalise to the UTC-midnight `Date` Prisma expects for a `@db.Date` column.
 *
 * `appointment_date` holds the clinic-local calendar date, so this must never
 * be built by converting an instant through a timezone.
 */
export function appointmentDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
