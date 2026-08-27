import { describe, expect, it } from "vitest";

import { generateSlots, type SlotAvailability } from "@/lib/slots";

import {
  FALL_BACK_SUNDAY,
  SPRING_FORWARD_SUNDAY,
  baseInput,
  localTimes,
} from "./fixtures";

/**
 * Sydney's DST transitions both land at 02:00 local, so these suites use an
 * overnight window that actually contains the boundary. Real clinic hours never
 * do — which is exactly why this has to be tested rather than observed.
 */
const OVERNIGHT: SlotAvailability = {
  dayOfWeek: "SUN",
  startTime: "01:00",
  endTime: "06:00",
  isActive: true,
};

describe("generateSlots — spring forward (2026-10-04, 02:00 AEST → 03:00 AEDT)", () => {
  const input = baseInput({
    date: SPRING_FORWARD_SUNDAY,
    availability: [OVERNIGHT],
  });

  it("offers no slot inside the hour that does not exist", () => {
    const times = localTimes(generateSlots(input));
    const inGap = times.filter((time) => time >= "02:00" && time < "03:00");

    expect(inGap).toEqual([]);
    expect(times).not.toContain("02:00");
  });

  it("jumps straight from 01:45 to 03:00", () => {
    const times = localTimes(generateSlots(input));

    expect(times.slice(0, 6)).toEqual([
      "01:00",
      "01:15",
      "01:30",
      "01:45",
      "03:00",
      "03:15",
    ]);
    expect(times).toHaveLength(15);
  });

  it("keeps a slot that straddles the gap at its true 30-minute length", () => {
    const straddling = generateSlots(input).find(
      (slot) => slot.startLocal === "01:45",
    );

    expect(straddling).toBeDefined();
    expect(straddling?.startUtc.toISOString()).toBe("2026-10-03T15:45:00.000Z");
    // Displayed 01:45 → 03:15, but only 30 minutes of the dentist's actual time.
    expect(straddling!.endUtc.getTime() - straddling!.startUtc.getTime()).toBe(
      30 * 60 * 1000,
    );
  });

  it("does not over-count when the window itself opens inside the gap", () => {
    // `fromZonedTime('02:00')` resolves backwards to 01:00 on this day. Without
    // the local-window re-check the generator would emit four phantom slots
    // before the clinic has opened.
    const slots = generateSlots(
      baseInput({
        date: SPRING_FORWARD_SUNDAY,
        availability: [{ ...OVERNIGHT, startTime: "02:00", endTime: "05:00" }],
      }),
    );

    expect(slots[0].startLocal).toBe("03:00");
    expect(slots[0].startUtc.toISOString()).toBe("2026-10-03T16:00:00.000Z");
    expect(slots).toHaveLength(7);
  });
});

describe("generateSlots — fall back (2026-04-05, 03:00 AEDT → 02:00 AEST)", () => {
  const input = baseInput({
    date: FALL_BACK_SUNDAY,
    availability: [OVERNIGHT],
  });

  it("offers the repeated hour exactly once", () => {
    const times = localTimes(generateSlots(input));

    expect(times.filter((time) => time === "02:00")).toHaveLength(1);
    expect(new Set(times).size).toBe(times.length);
    expect(times).toHaveLength(19);
  });

  it("keeps the second (standard time) occurrence of 02:00", () => {
    const two = generateSlots(input).find(
      (slot) => slot.startLocal === "02:00",
    );

    // 16:00Z is 02:00 +10:00 (AEST). The first pass, 15:00Z / 02:00 +11:00
    // (AEDT), is dropped — an appointment is stored as (date, "HH:mm") in
    // clinic-local terms, so only one of the two is representable, and this is
    // the one the booking path re-derives from the patient's chosen time.
    expect(two?.startUtc.toISOString()).toBe("2026-04-04T16:00:00.000Z");
  });

  it("keeps every repeated quarter-hour on standard time", () => {
    const slots = generateSlots(input);
    const repeated = slots.filter((slot) => slot.startLocal.startsWith("02:"));

    expect(localTimes(repeated)).toEqual(["02:00", "02:15", "02:30", "02:45"]);
    expect(repeated.map((slot) => slot.startUtc.toISOString())).toEqual([
      "2026-04-04T16:00:00.000Z",
      "2026-04-04T16:15:00.000Z",
      "2026-04-04T16:30:00.000Z",
      "2026-04-04T16:45:00.000Z",
    ]);
  });

  it("runs 01:45 straight into 02:00 with an hour of real time between them", () => {
    const slots = generateSlots(input);
    const before = slots.find((slot) => slot.startLocal === "01:45")!;
    const after = slots.find((slot) => slot.startLocal === "02:00")!;

    expect(before.startUtc.toISOString()).toBe("2026-04-04T14:45:00.000Z");
    // 75 minutes apart on the absolute timeline, 15 on the clock.
    expect(after.startUtc.getTime() - before.startUtc.getTime()).toBe(
      75 * 60 * 1000,
    );
  });

  it("uses the extra hour: the window is 5 clock hours but 6 real ones", () => {
    const slots = generateSlots(input);
    const first = slots[0];
    const last = slots.at(-1)!;

    expect(first.startLocal).toBe("01:00");
    expect(last.startLocal).toBe("05:30");
    expect(last.endUtc.getTime() - first.startUtc.getTime()).toBe(
      6 * 60 * 60 * 1000,
    );
  });
});
