import { isBefore, parse, format, addMinutes } from "date-fns";
import type { TimeSlot } from "@/types";

/**
 * Generate all possible time slots for a given day window.
 * Pure function — no DB calls, fully unit-testable.
 */
export function generateSlots(
  startTime: string,  // "HH:mm"
  endTime: string,    // "HH:mm"
  durationMinutes: number,
  referenceDate: Date,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const base = format(referenceDate, "yyyy-MM-dd");

  let cursor = parse(`${base} ${startTime}`, "yyyy-MM-dd HH:mm", new Date());
  const end = parse(`${base} ${endTime}`, "yyyy-MM-dd HH:mm", new Date());

  while (isBefore(addMinutes(cursor, durationMinutes), end) ||
         addMinutes(cursor, durationMinutes).getTime() === end.getTime()) {
    const slotEnd = addMinutes(cursor, durationMinutes);
    slots.push({
      startTime: format(cursor, "HH:mm"),
      endTime: format(slotEnd, "HH:mm"),
      available: true,
    });
    cursor = addMinutes(cursor, durationMinutes);
  }

  return slots;
}

/**
 * Remove slots that overlap with existing booked appointments.
 */
export function filterBookedSlots(
  slots: TimeSlot[],
  bookedSlots: Array<{ startTime: string; endTime: string }>,
): TimeSlot[] {
  return slots.map((slot) => {
    const isBooked = bookedSlots.some(
      (booked) =>
        timesOverlap(slot.startTime, slot.endTime, booked.startTime, booked.endTime),
    );
    return { ...slot, available: !isBooked };
  });
}

/**
 * Remove slots that are in the past (for today's date).
 */
export function filterPastSlots(slots: TimeSlot[], referenceDate: Date, now: Date): TimeSlot[] {
  const base = format(referenceDate, "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  if (base !== today) return slots;

  return slots.map((slot) => {
    const slotTime = parse(`${base} ${slot.startTime}`, "yyyy-MM-dd HH:mm", new Date());
    return { ...slot, available: slot.available && !isBefore(slotTime, now) };
  });
}

/**
 * Returns true if [start1, end1) overlaps with [start2, end2).
 * Times are "HH:mm" strings.
 */
export function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  return s1 < e2 && e1 > s2;
}
