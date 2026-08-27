import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { DayOfWeek } from "@prisma/client";

import { CLINIC_TIMEZONE, SLOT_STEP_MINUTES } from "@/lib/constants";

/**
 * Slot generation. Pure functions only — no DB access, no `new Date()`.
 *
 * `now` is injected and the timezone is a parameter, so every branch here is
 * reachable from a unit test. The DB-touching wrapper is `lib/availability.ts`.
 *
 * See docs/booking-flow.md, "Slot Generation Algorithm".
 */

/** A dentist's weekly working window. Times are clinic-local wall clock. */
export type SlotAvailability = {
  dayOfWeek: DayOfWeek;
  /** "HH:mm" in the clinic timezone — NOT UTC. See docs/database.md:34. */
  startTime: string;
  /** "HH:mm" in the clinic timezone. */
  endTime: string;
  isActive: boolean;
};

/** A day the dentist is unavailable regardless of their weekly schedule. */
export type SlotBlockedDate = {
  /** UTC midnight of the blocked clinic-local calendar date. */
  date: Date;
};

/** An already-booked span, as absolute instants. */
export type BookedInterval = {
  startUtc: Date;
  endUtc: Date;
};

export type GenerateSlotsInput = {
  /** The day the patient wants: UTC midnight of that clinic-local date. */
  date: Date;
  serviceDurationMinutes: number;
  /** The dentist's full weekly schedule; the matching day is selected here. */
  availability: SlotAvailability[];
  /** Blocked dates for this dentist. Only entries matching `date` matter. */
  blockedDates: SlotBlockedDate[];
  /** PENDING or CONFIRMED appointments for this dentist on this date. */
  existingAppointments: BookedInterval[];
  /** Injected — never read from `new Date()` inside this module. */
  now: Date;
  /** IANA zone. Defaults to the clinic's. */
  timezone?: string;
  /** Slot granularity. Defaults to `SLOT_STEP_MINUTES` (15). */
  stepMinutes?: number;
};

export type Slot = {
  startUtc: Date;
  endUtc: Date;
  /** "HH:mm" in the clinic timezone, for display. */
  startLocal: string;
};

/**
 * Safety valve on the enumeration loop. A fall-back day is 25 hours long, so
 * one candidate per minute of a 26-hour day can never be legitimately exceeded.
 */
const MAX_CANDIDATES_PER_WINDOW = 26 * 60;

/** `Date#getUTCDay()` returns 0 for Sunday. */
const DAY_OF_WEEK_BY_INDEX: readonly DayOfWeek[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];

/**
 * The clinic-local calendar date of a `@db.Date` value, as "yyyy-MM-dd".
 *
 * Prisma hands back `date` columns as UTC midnight, and `appointment_date`
 * stores the clinic-local calendar date — so the UTC *parts* already are the
 * clinic-local date. Reading them in the clinic timezone instead would shift
 * the day for any zone behind UTC.
 */
export function clinicDateKey(date: Date): string {
  return formatInTimeZone(date, "UTC", "yyyy-MM-dd");
}

/**
 * Interpret a clinic-local wall clock time on a calendar date as an instant.
 *
 * This is the single conversion used by both the generator and the booking
 * path, which is what guarantees a slot the patient was offered resolves to
 * the same instant when they confirm it.
 */
export function clinicTimeToUtc(
  dateKey: string,
  time: string,
  timezone: string = CLINIC_TIMEZONE,
): Date {
  return fromZonedTime(`${dateKey} ${time}:00`, timezone);
}

/** The clinic-local wall clock time of an instant, as "HH:mm". */
export function utcToClinicTime(
  instant: Date,
  timezone: string = CLINIC_TIMEZONE,
): string {
  return formatInTimeZone(instant, timezone, "HH:mm");
}

/**
 * Half-open overlap test: `[aStart, aEnd)` against `[bStart, bEnd)`.
 *
 * Strict inequalities on both sides, so back-to-back appointments (09:00-09:30
 * and 09:30-10:00) do not overlap. docs/booking-flow.md requires this.
 */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Generate the bookable slots for one dentist on one day.
 *
 * Steps by `stepMinutes` (15) rather than by service duration: stepping by
 * duration silently hides valid slots — with a 30-min checkup at 09:00, a
 * 60-min service would only ever be offered 09:30-10:30, never 10:00-11:00.
 */
export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const {
    date,
    serviceDurationMinutes,
    availability,
    blockedDates,
    existingAppointments,
    now,
    timezone = CLINIC_TIMEZONE,
    stepMinutes = SLOT_STEP_MINUTES,
  } = input;

  // A non-positive step would spin forever; a non-positive duration is bad
  // service data rather than a programming error, so it just yields nothing.
  if (stepMinutes <= 0) {
    throw new RangeError(
      `stepMinutes must be positive, received ${stepMinutes}`,
    );
  }
  if (serviceDurationMinutes <= 0) return [];

  const dateKey = clinicDateKey(date);

  // 1. Blocked dates win over everything else.
  if (blockedDates.some((blocked) => clinicDateKey(blocked.date) === dateKey))
    return [];

  // 2. Resolve the day of week and the windows that apply to it.
  const dayOfWeek = dayOfWeekFor(dateKey);
  const windows = availability.filter(
    (row) => row.isActive && row.dayOfWeek === dayOfWeek,
  );
  if (windows.length === 0) return [];

  const slots: Slot[] = [];
  // Dedupe on the ISO UTC string, so overlapping availability rows (and the
  // repeated hour of a fall-back day) can never yield the same instant twice.
  const seen = new Set<string>();

  for (const window of windows) {
    // 3. Build the working window on the absolute timeline.
    const windowStartUtc = clinicTimeToUtc(dateKey, window.startTime, timezone);
    const windowEndUtc = clinicTimeToUtc(dateKey, window.endTime, timezone);

    // Midnight-spanning shifts are not supported in the MVP — see the edge
    // case table in docs/booking-flow.md.
    if (windowEndUtc <= windowStartUtc) continue;

    // 4. Enumerate candidates on the grid. Stepping along UTC rather than
    // local time keeps the cursor on a continuous axis, so a DST jump cannot
    // make it stall or skip.
    let candidates = 0;
    for (
      let start = windowStartUtc;
      start < windowEndUtc && candidates < MAX_CANDIDATES_PER_WINDOW;
      start = addMinutes(start, stepMinutes), candidates++
    ) {
      const end = addMinutes(start, serviceDurationMinutes);

      // The service would run past the end of the working day. Later
      // candidates start later still, so nothing after this can fit.
      if (end > windowEndUtc) break;

      // Slot is in the past.
      if (start < now) continue;

      const startLocal = formatInTimeZone(start, timezone, "yyyy-MM-dd HH:mm");
      const endLocal = formatInTimeZone(end, timezone, "yyyy-MM-dd HH:mm");

      // Re-check the window against the *local* clock. On a spring-forward day
      // the declared start may fall in the missing hour, which `fromZonedTime`
      // resolves backwards — a window declared 02:00-05:00 would otherwise
      // start generating at 01:00 and over-count by four slots.
      if (!isWithinLocalWindow(startLocal, endLocal, dateKey, window)) continue;

      const startClock = startLocal.slice(11);

      // DST round-trip. On a fall-back day 02:00-03:00 happens twice, and both
      // occurrences are real instants — but an appointment is stored as
      // (date, "HH:mm") in clinic-local terms, so only one of them is
      // representable. Keep the occurrence that `clinicTimeToUtc` resolves to,
      // because that is the one the booking path will re-derive from the
      // patient's chosen "HH:mm". For Australia/Sydney that is the second
      // (standard time) occurrence, as docs/booking-flow.md specifies.
      if (
        clinicTimeToUtc(dateKey, startClock, timezone).getTime() !==
        start.getTime()
      )
        continue;

      // 5. Discard overlaps with existing appointments.
      const isTaken = existingAppointments.some((appointment) =>
        intervalsOverlap(start, end, appointment.startUtc, appointment.endUtc),
      );
      if (isTaken) continue;

      const key = start.toISOString();
      if (seen.has(key)) continue;
      seen.add(key);

      slots.push({ startUtc: start, endUtc: end, startLocal: startClock });
    }
  }

  slots.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  return slots;
}

/** Day of week of a "yyyy-MM-dd" clinic-local calendar date. */
function dayOfWeekFor(dateKey: string): DayOfWeek {
  const [year, month, day] = dateKey.split("-").map(Number);
  const index = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return DAY_OF_WEEK_BY_INDEX[index];
}

/**
 * Whether a candidate sits inside the window as the clinic's wall clock sees
 * it. "HH:mm" is zero-padded 24-hour, so lexicographic comparison is ordinal.
 */
function isWithinLocalWindow(
  startLocal: string,
  endLocal: string,
  dateKey: string,
  window: Pick<SlotAvailability, "startTime" | "endTime">,
): boolean {
  if (startLocal.slice(0, 10) !== dateKey || endLocal.slice(0, 10) !== dateKey)
    return false;
  return (
    startLocal.slice(11) >= window.startTime &&
    endLocal.slice(11) <= window.endTime
  );
}
