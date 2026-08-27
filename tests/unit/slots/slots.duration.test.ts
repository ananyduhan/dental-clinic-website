import { describe, expect, it } from "vitest";

import { generateSlots } from "@/lib/slots";

import { baseInput, localTimes, sydney } from "./fixtures";

describe("generateSlots — service durations", () => {
  // One 09:00-17:00 window (480 minutes) on the 15-minute grid throughout.
  it.each([
    { minutes: 30, count: 31, lastStart: "16:30" },
    { minutes: 45, count: 30, lastStart: "16:15" },
    { minutes: 60, count: 29, lastStart: "16:00" },
    { minutes: 90, count: 27, lastStart: "15:30" },
  ])(
    "fits $minutes-minute services $count times, last at $lastStart",
    (service) => {
      const slots = generateSlots(
        baseInput({ serviceDurationMinutes: service.minutes }),
      );

      expect(slots).toHaveLength(service.count);
      expect(slots[0].startLocal).toBe("09:00");
      expect(slots.at(-1)?.startLocal).toBe(service.lastStart);
    },
  );

  it("always sets endUtc to exactly the service duration after startUtc", () => {
    for (const minutes of [30, 45, 60, 90]) {
      const slots = generateSlots(
        baseInput({ serviceDurationMinutes: minutes }),
      );

      for (const slot of slots) {
        expect(slot.endUtc.getTime() - slot.startUtc.getTime()).toBe(
          minutes * 60 * 1000,
        );
      }
    }
  });

  it("never lets a service run past the end of the working day", () => {
    const slots = generateSlots(baseInput({ serviceDurationMinutes: 90 }));
    const closing = sydney("2026-09-07", "17:00");

    for (const slot of slots) {
      expect(slot.endUtc.getTime()).toBeLessThanOrEqual(closing.getTime());
    }
  });

  it("offers exactly one slot when the service fills the whole day", () => {
    const slots = generateSlots(baseInput({ serviceDurationMinutes: 480 }));

    expect(localTimes(slots)).toEqual(["09:00"]);
  });

  it("offers nothing when the service is longer than the working day", () => {
    expect(generateSlots(baseInput({ serviceDurationMinutes: 495 }))).toEqual(
      [],
    );
    expect(generateSlots(baseInput({ serviceDurationMinutes: 600 }))).toEqual(
      [],
    );
  });

  it("still offers 10:00 for a 60-minute service after a 30-minute booking at 09:00", () => {
    // The reason the grid steps by 15 rather than by duration. Stepping by
    // duration from the end of the 09:00 booking would offer 09:30-10:30 and
    // silently hide 10:00-11:00. See docs/booking-flow.md.
    const slots = generateSlots(
      baseInput({
        serviceDurationMinutes: 60,
        existingAppointments: [
          {
            startUtc: sydney("2026-09-07", "09:00"),
            endUtc: sydney("2026-09-07", "09:30"),
          },
        ],
      }),
    );
    const times = localTimes(slots);

    expect(times).toContain("09:30");
    expect(times).toContain("10:00");
    expect(times[0]).toBe("09:30");
  });

  it("packs a duration that does not divide the grid onto the grid anyway", () => {
    const slots = generateSlots(baseInput({ serviceDurationMinutes: 20 }));

    expect(localTimes(slots).slice(0, 4)).toEqual([
      "09:00",
      "09:15",
      "09:30",
      "09:45",
    ]);
    expect(slots[0].endUtc.toISOString()).toBe("2026-09-06T23:20:00.000Z");
  });
});
