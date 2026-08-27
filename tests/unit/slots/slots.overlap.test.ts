import { describe, expect, it } from "vitest";

import { generateSlots, intervalsOverlap } from "@/lib/slots";

import { baseInput, localTimes, sydney } from "./fixtures";

/** A booked span expressed in clinic-local wall clock on the fixture Monday. */
function booked(startTime: string, endTime: string) {
  return {
    startUtc: sydney("2026-09-07", startTime),
    endUtc: sydney("2026-09-07", endTime),
  };
}

describe("generateSlots — overlaps", () => {
  it("removes every candidate that straddles a booking", () => {
    const slots = generateSlots(
      baseInput({ existingAppointments: [booked("10:00", "10:30")] }),
    );
    const times = localTimes(slots);

    // 09:45-10:15, 10:00-10:30 and 10:15-10:45 all collide.
    expect(times).not.toContain("09:45");
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("10:15");
    expect(slots).toHaveLength(28);
  });

  it("allows back-to-back bookings on both sides", () => {
    const slots = generateSlots(
      baseInput({ existingAppointments: [booked("10:00", "10:30")] }),
    );
    const times = localTimes(slots);

    // 09:30-10:00 ends exactly as the booking starts; 10:30-11:00 starts as it ends.
    expect(times).toContain("09:30");
    expect(times).toContain("10:30");
  });

  it("removes candidates fully contained by a longer booking", () => {
    const slots = generateSlots(
      baseInput({ existingAppointments: [booked("10:00", "11:00")] }),
    );
    const times = localTimes(slots);

    for (const blocked of ["09:45", "10:00", "10:15", "10:30", "10:45"]) {
      expect(times).not.toContain(blocked);
    }
    expect(times).toContain("09:30");
    expect(times).toContain("11:00");
    expect(slots).toHaveLength(26);
  });

  it("returns nothing when the whole day is booked", () => {
    const slots = generateSlots(
      baseInput({ existingAppointments: [booked("09:00", "17:00")] }),
    );

    expect(slots).toEqual([]);
  });

  it("handles a booking flush against the end of the day", () => {
    const slots = generateSlots(
      baseInput({ existingAppointments: [booked("16:30", "17:00")] }),
    );

    // 16:15-16:45 collides; 16:00-16:30 is back-to-back and survives.
    expect(slots.at(-1)?.startLocal).toBe("16:00");
  });

  it("subtracts several bookings independently", () => {
    const slots = generateSlots(
      baseInput({
        existingAppointments: [
          booked("09:00", "09:30"),
          booked("13:00", "14:00"),
        ],
      }),
    );
    const times = localTimes(slots);

    expect(times[0]).toBe("09:30");
    for (const blocked of ["12:45", "13:00", "13:15", "13:30", "13:45"]) {
      expect(times).not.toContain(blocked);
    }
    expect(times).toContain("14:00");
  });

  it("ignores bookings that fall outside the working window", () => {
    const slots = generateSlots(
      baseInput({ existingAppointments: [booked("07:00", "08:00")] }),
    );

    expect(slots).toHaveLength(31);
  });
});

describe("intervalsOverlap", () => {
  const at = (time: string) => sydney("2026-09-07", time);

  it("is true when the spans intersect", () => {
    expect(
      intervalsOverlap(at("09:00"), at("10:00"), at("09:30"), at("10:30")),
    ).toBe(true);
    expect(
      intervalsOverlap(at("09:30"), at("10:30"), at("09:00"), at("10:00")),
    ).toBe(true);
    expect(
      intervalsOverlap(at("09:15"), at("09:45"), at("09:00"), at("10:00")),
    ).toBe(true);
  });

  it("is false when the spans merely touch", () => {
    expect(
      intervalsOverlap(at("09:00"), at("10:00"), at("10:00"), at("11:00")),
    ).toBe(false);
    expect(
      intervalsOverlap(at("10:00"), at("11:00"), at("09:00"), at("10:00")),
    ).toBe(false);
  });

  it("is false when the spans are disjoint", () => {
    expect(
      intervalsOverlap(at("09:00"), at("10:00"), at("14:00"), at("15:00")),
    ).toBe(false);
  });
});
