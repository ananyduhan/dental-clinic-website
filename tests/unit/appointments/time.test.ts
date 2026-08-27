import { describe, expect, it } from "vitest";

import {
  appointmentDateFromKey,
  appointmentInterval,
  endTimeFor,
} from "@/lib/appointments/time";

const TZ = "Australia/Sydney";

describe("endTimeFor", () => {
  it("adds the duration on an ordinary day", () => {
    expect(endTimeFor("2026-09-07", "10:00", 30, TZ)).toBe("10:30");
    expect(endTimeFor("2026-09-07", "09:15", 45, TZ)).toBe("10:00");
    expect(endTimeFor("2026-09-07", "13:30", 90, TZ)).toBe("15:00");
  });

  it("adds real minutes, not clock minutes, across the spring-forward gap", () => {
    // 01:45 + 30 real minutes lands at 03:15 on the wall clock, because the
    // hour 02:00-03:00 does not exist on 2026-10-04.
    expect(endTimeFor("2026-10-04", "01:45", 30, TZ)).toBe("03:15");
  });

  it("adds real minutes across the fall-back repeat", () => {
    // 01:45 +11:00 is 14:45Z; +30 min is 15:15Z, still the first pass of 02:15.
    expect(endTimeFor("2026-04-05", "01:45", 30, TZ)).toBe("02:15");
    // 02:00 resolves to the second pass (16:00Z), so its end is 02:30 standard.
    expect(endTimeFor("2026-04-05", "02:00", 30, TZ)).toBe("02:30");
  });
});

describe("appointmentInterval", () => {
  it("resolves a stored appointment onto the absolute timeline", () => {
    const { startUtc, endUtc } = appointmentInterval(
      {
        appointmentDate: new Date("2026-09-07T00:00:00.000Z"),
        startTime: "10:00",
        endTime: "10:30",
      },
      TZ,
    );

    // AEST is +10 in September.
    expect(startUtc.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-09-07T00:30:00.000Z");
  });

  it("uses the stored date's UTC parts as the clinic calendar date", () => {
    const { startUtc } = appointmentInterval(
      {
        appointmentDate: new Date("2026-01-15T00:00:00.000Z"),
        startTime: "09:00",
        endTime: "09:30",
      },
      TZ,
    );

    // AEDT is +11 in January.
    expect(startUtc.toISOString()).toBe("2026-01-14T22:00:00.000Z");
  });
});

describe("appointmentDateFromKey", () => {
  it("produces the UTC midnight Prisma expects for a date column", () => {
    expect(appointmentDateFromKey("2026-09-07").toISOString()).toBe(
      "2026-09-07T00:00:00.000Z",
    );
  });
});
