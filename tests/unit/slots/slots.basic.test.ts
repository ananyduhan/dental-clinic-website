import { describe, expect, it } from "vitest";

import { generateSlots } from "@/lib/slots";

import {
  DISTANT_PAST,
  MONDAY,
  MONDAY_NINE_TO_FIVE,
  TZ,
  baseInput,
  localTimes,
  sydney,
  utcMidnight,
} from "./fixtures";

describe("generateSlots — basics", () => {
  it("fills a 09:00-17:00 Monday with 30-minute slots on the 15-minute grid", () => {
    const slots = generateSlots(baseInput());

    // 480 minutes of window, last start that still fits a 30-min service is 16:30.
    expect(slots).toHaveLength(31);
    expect(slots[0].startLocal).toBe("09:00");
    expect(slots.at(-1)?.startLocal).toBe("16:30");
    expect(localTimes(slots.slice(0, 4))).toEqual([
      "09:00",
      "09:15",
      "09:30",
      "09:45",
    ]);
  });

  it("anchors slots to the clinic timezone, not the machine's", () => {
    const [first] = generateSlots(baseInput());

    // 09:00 Sydney in September is AEST (+10).
    expect(first.startUtc.toISOString()).toBe("2026-09-06T23:00:00.000Z");
    expect(first.endUtc.toISOString()).toBe("2026-09-06T23:30:00.000Z");
    expect(first.startLocal).toBe("09:00");
  });

  it("returns slots in ascending order", () => {
    const slots = generateSlots(baseInput());
    const times = slots.map((slot) => slot.startUtc.getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("returns nothing when the dentist does not work that day", () => {
    // 2026-09-06 is a Sunday; the only availability row is for Monday.
    const slots = generateSlots(baseInput({ date: utcMidnight("2026-09-06") }));

    expect(slots).toEqual([]);
  });

  it("returns nothing when the matching availability row is inactive", () => {
    const slots = generateSlots(
      baseInput({
        availability: [{ ...MONDAY_NINE_TO_FIVE, isActive: false }],
      }),
    );

    expect(slots).toEqual([]);
  });

  it("returns nothing when the availability list is empty", () => {
    expect(generateSlots(baseInput({ availability: [] }))).toEqual([]);
  });

  it("returns nothing when the day is blocked", () => {
    const slots = generateSlots(
      baseInput({ blockedDates: [{ date: MONDAY }] }),
    );

    expect(slots).toEqual([]);
  });

  it("ignores blocked dates for other days", () => {
    const slots = generateSlots(
      baseInput({ blockedDates: [{ date: utcMidnight("2026-09-14") }] }),
    );

    expect(slots).toHaveLength(31);
  });

  it("drops slots that start before `now`", () => {
    const slots = generateSlots(
      baseInput({ now: sydney("2026-09-07", "12:00") }),
    );

    expect(slots[0].startLocal).toBe("12:00");
    expect(slots).toHaveLength(19);
  });

  it("keeps a slot starting exactly at `now`", () => {
    const now = sydney("2026-09-07", "09:00");
    const slots = generateSlots(baseInput({ now }));

    expect(slots[0].startUtc.getTime()).toBe(now.getTime());
  });

  it("returns nothing when `now` is past the end of the working day", () => {
    expect(
      generateSlots(baseInput({ now: sydney("2026-09-08", "09:00") })),
    ).toEqual([]);
  });

  it("honours a custom step size", () => {
    const slots = generateSlots(baseInput({ stepMinutes: 30 }));

    expect(slots).toHaveLength(16);
    expect(localTimes(slots.slice(0, 3))).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("returns nothing for a non-positive service duration", () => {
    expect(generateSlots(baseInput({ serviceDurationMinutes: 0 }))).toEqual([]);
    expect(generateSlots(baseInput({ serviceDurationMinutes: -30 }))).toEqual(
      [],
    );
  });

  it("refuses a non-positive step rather than looping forever", () => {
    expect(() => generateSlots(baseInput({ stepMinutes: 0 }))).toThrow(
      RangeError,
    );
    expect(() => generateSlots(baseInput({ stepMinutes: -15 }))).toThrow(
      RangeError,
    );
  });

  it("returns nothing when the window ends before it starts", () => {
    const slots = generateSlots(
      baseInput({
        availability: [
          { ...MONDAY_NINE_TO_FIVE, startTime: "17:00", endTime: "09:00" },
        ],
      }),
    );

    expect(slots).toEqual([]);
  });

  it("merges overlapping availability rows without emitting an instant twice", () => {
    const slots = generateSlots(
      baseInput({
        availability: [
          MONDAY_NINE_TO_FIVE,
          {
            dayOfWeek: "MON",
            startTime: "13:00",
            endTime: "17:00",
            isActive: true,
          },
        ],
      }),
    );

    expect(new Set(localTimes(slots)).size).toBe(slots.length);
    expect(slots).toHaveLength(31);
  });

  it("defaults `now` filtering and timezone independently of each other", () => {
    // Same wall clock, different zone: Perth is +08, so 09:00 Sydney is 07:00 there.
    const slots = generateSlots(baseInput({ timezone: "Australia/Perth" }));

    expect(slots[0].startLocal).toBe("09:00");
    expect(slots[0].startUtc.toISOString()).toBe("2026-09-07T01:00:00.000Z");
    expect(TZ).toBe("Australia/Sydney");
    expect(DISTANT_PAST.getUTCFullYear()).toBe(2026);
  });
});
