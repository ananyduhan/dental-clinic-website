import type { GenerateSlotsInput, SlotAvailability } from "@/lib/slots";

/**
 * Shared fixtures for the slot suites.
 *
 * The timezone is passed explicitly everywhere rather than relying on
 * `CLINIC_TIMEZONE`, so these tests do not depend on the machine's `.env`.
 */

export const TZ = "Australia/Sydney";

/** A Monday, comfortably inside AEST (+10). DST starts 2026-10-04. */
export const MONDAY = utcMidnight("2026-09-07");

/** Sydney loses 02:00-03:00 on this Sunday: 02:00 AEST -> 03:00 AEDT. */
export const SPRING_FORWARD_SUNDAY = utcMidnight("2026-10-04");

/** Sydney repeats 02:00-03:00 on this Sunday: 03:00 AEDT -> 02:00 AEST. */
export const FALL_BACK_SUNDAY = utcMidnight("2026-04-05");

/** Long before any fixture date, so nothing is filtered as past. */
export const DISTANT_PAST = new Date("2026-01-01T00:00:00.000Z");

export const MONDAY_NINE_TO_FIVE: SlotAvailability = {
  dayOfWeek: "MON",
  startTime: "09:00",
  endTime: "17:00",
  isActive: true,
};

export function utcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * A clinic-local wall clock time on a given date, as an instant.
 *
 * Only valid away from the transition days — on those the offset changes
 * mid-day, so `slots.dst.test.ts` asserts against literal UTC instants instead.
 */
export function sydney(dateKey: string, time: string): Date {
  // Written out rather than reusing `clinicTimeToUtc` so the tests assert
  // against an independent source of truth for the offset.
  return new Date(`${dateKey}T${time}:00${offsetFor(dateKey)}`);
}

/** Sydney is +11 (AEDT) between the October and April transitions, else +10. */
function offsetFor(dateKey: string): string {
  const isDaylightSaving = dateKey >= "2026-10-04" || dateKey < "2026-04-05";
  return isDaylightSaving ? "+11:00" : "+10:00";
}

export function baseInput(overrides: Partial<GenerateSlotsInput> = {}): GenerateSlotsInput {
  return {
    date: MONDAY,
    serviceDurationMinutes: 30,
    availability: [MONDAY_NINE_TO_FIVE],
    blockedDates: [],
    existingAppointments: [],
    now: DISTANT_PAST,
    timezone: TZ,
    ...overrides,
  };
}

export function localTimes(slots: Array<{ startLocal: string }>): string[] {
  return slots.map((slot) => slot.startLocal);
}
