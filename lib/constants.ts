/**
 * Application-wide constants.
 *
 * Values that vary per deployment are read from env with a safe default so that
 * a missing variable degrades predictably instead of failing at import time.
 */

/**
 * IANA timezone of the clinic.
 *
 * Everything in the database is UTC. This is the single conversion boundary —
 * see docs/booking-flow.md, "Timezone rules". Read from env so a second clinic
 * (or a move) does not require a code change.
 */
export const CLINIC_TIMEZONE = resolveTimezone(process.env.CLINIC_TIMEZONE);

/**
 * Granularity of the slot grid, in minutes.
 *
 * Deliberately smaller than any service duration. Stepping by service duration
 * would hide valid slots: with a 30-min checkup at 09:00, a 60-min service would
 * only ever be offered 09:30-10:30, never 10:00-11:00.
 * See docs/booking-flow.md, "Why step 15 minutes instead of serviceDurationMinutes".
 */
export const SLOT_STEP_MINUTES = 15;

/**
 * How far ahead of an appointment a patient may still cancel or reschedule.
 *
 * Exactly 24 hours, no fuzz factor — a patient at 23h59m is refused and pointed
 * at the clinic phone number. Admins are not subject to this.
 * See docs/booking-flow.md, "The 24-hour rule".
 */
export const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Window the reminder cron sweeps on each hourly run: appointments starting
 * between now+23h and now+25h that have not been reminded yet.
 */
export const REMINDER_WINDOW_START_HOURS = 23;
export const REMINDER_WINDOW_END_HOURS = 25;

/** Maximum length of patient-supplied appointment notes. */
export const MAX_NOTES_LENGTH = 1000;

/** Default page size for paginated list endpoints. */
export const DEFAULT_PAGE_SIZE = 20;

/** Hard ceiling on page size, so a crafted `?limit=` cannot dump the table. */
export const MAX_PAGE_SIZE = 100;

const DEFAULT_TIMEZONE = "Australia/Sydney";

/**
 * Validate that a timezone string is one the runtime actually knows.
 *
 * A typo'd timezone is worse than a missing one: `date-fns-tz` would silently
 * fall back to UTC and every displayed appointment time would be wrong by hours
 * with nothing in the logs to say so.
 */
function resolveTimezone(value: string | undefined): string {
  if (!value) return DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value });
    return value;
  } catch {
    // Never throw at import time — that would take down the whole app for a
    // typo in an env var. Fall back loudly instead.
    console.error(
      `[constants] CLINIC_TIMEZONE="${value}" is not a valid IANA timezone. ` +
        `Falling back to ${DEFAULT_TIMEZONE}. Appointment times may be wrong.`,
    );
    return DEFAULT_TIMEZONE;
  }
}
