import { formatInTimeZone } from "date-fns-tz";

import { CLINIC_TIMEZONE } from "@/lib/constants";
import { clinicDateKey } from "@/lib/slots";

/**
 * Display formatting for appointment dates and times.
 *
 * Shared so every surface renders a booking the same way, and so the "read the
 * UTC parts of a `@db.Date`" rule is applied in exactly one place — formatting
 * `appointment_date` in the clinic timezone would shift the day.
 */

/** "Monday, 7 September 2026", or "7 Sep" in short form. */
export function formatClinicDate(
  date: Date,
  variant: "long" | "short" = "long",
): string {
  return formatInTimeZone(
    date,
    "UTC",
    variant === "long" ? "EEEE, d MMMM yyyy" : "d MMM yyyy",
  );
}

/** "HH:mm" clinic-local to a 12-hour label — "14:30" becomes "2:30 PM". */
export function formatClinicTime(startTime: string): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** The stored calendar date as "yyyy-MM-dd", for form fields and query params. */
export function toDateKey(date: Date): string {
  return clinicDateKey(date);
}

/** "Monday, 7 September 2026 at 2:30 PM", for emails and confirmations. */
export function formatClinicDateTime(date: Date, startTime: string): string {
  return `${formatClinicDate(date)} at ${formatClinicTime(startTime)}`;
}

export { CLINIC_TIMEZONE };
