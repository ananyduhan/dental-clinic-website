import { AppointmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  assertTransitionAllowed,
  type Actor,
  type TransitionableAppointment,
} from "@/lib/appointments/transition";

const TZ = "Australia/Sydney";

/** 10:00-10:30 on Monday 2026-09-07, which is 00:00-00:30 UTC (AEST, +10). */
const START_UTC = new Date("2026-09-07T00:00:00.000Z");
const END_UTC = new Date("2026-09-07T00:30:00.000Z");

const PATIENT: Actor = { role: "PATIENT", userId: "patient-1" };
const OTHER_PATIENT: Actor = { role: "PATIENT", userId: "patient-2" };
const ADMIN: Actor = { role: "ADMIN", userId: "admin-1" };
const DENTIST: Actor = {
  role: "DENTIST",
  userId: "user-d1",
  dentistId: "dentist-1",
};
const OTHER_DENTIST: Actor = {
  role: "DENTIST",
  userId: "user-d2",
  dentistId: "dentist-2",
};

function appointment(
  overrides: Partial<TransitionableAppointment> = {},
): TransitionableAppointment {
  return {
    id: "appt-1",
    patientId: "patient-1",
    dentistId: "dentist-1",
    status: AppointmentStatus.PENDING,
    appointmentDate: new Date("2026-09-07T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "10:30",
    ...overrides,
  };
}

function attempt(
  to: AppointmentStatus,
  actor: Actor,
  now: Date,
  overrides: Partial<TransitionableAppointment> = {},
) {
  return () =>
    assertTransitionAllowed({
      appointment: appointment(overrides),
      to,
      actor,
      now,
      timezone: TZ,
    });
}

/** Comfortably outside the 24-hour window. */
const WELL_BEFORE = new Date("2026-09-01T00:00:00.000Z");
/** Exactly 24 hours before the start. */
const EXACTLY_24H = new Date(START_UTC.getTime() - 24 * 60 * 60 * 1000);
/** One millisecond inside the window. */
const JUST_INSIDE = new Date(EXACTLY_24H.getTime() + 1);

describe("assertTransitionAllowed — PENDING → CONFIRMED", () => {
  it("allows an admin", () => {
    expect(
      attempt(AppointmentStatus.CONFIRMED, ADMIN, WELL_BEFORE),
    ).not.toThrow();
  });

  it("allows the dentist the appointment belongs to", () => {
    expect(
      attempt(AppointmentStatus.CONFIRMED, DENTIST, WELL_BEFORE),
    ).not.toThrow();
  });

  it("refuses another dentist as if the appointment did not exist", () => {
    expect(
      attempt(AppointmentStatus.CONFIRMED, OTHER_DENTIST, WELL_BEFORE),
    ).toThrow(NotFoundError);
  });

  it("refuses the patient — confirmation is the clinic's call", () => {
    expect(attempt(AppointmentStatus.CONFIRMED, PATIENT, WELL_BEFORE)).toThrow(
      ForbiddenError,
    );
  });
});

describe("assertTransitionAllowed — cancellation and the 24-hour rule", () => {
  it("lets a patient cancel more than 24 hours out", () => {
    expect(
      attempt(AppointmentStatus.CANCELLED, PATIENT, WELL_BEFORE),
    ).not.toThrow();
  });

  it("refuses a patient at exactly 24 hours — no fuzz factor", () => {
    expect(attempt(AppointmentStatus.CANCELLED, PATIENT, EXACTLY_24H)).toThrow(
      ValidationError,
    );
  });

  it("refuses a patient one millisecond inside the window", () => {
    expect(attempt(AppointmentStatus.CANCELLED, PATIENT, JUST_INSIDE)).toThrow(
      ValidationError,
    );
  });

  it("points the patient at the clinic phone number", () => {
    expect(attempt(AppointmentStatus.CANCELLED, PATIENT, JUST_INSIDE)).toThrow(
      /call the clinic/i,
    );
  });

  it("lets an admin cancel at any time", () => {
    expect(
      attempt(AppointmentStatus.CANCELLED, ADMIN, JUST_INSIDE),
    ).not.toThrow();
    expect(
      attempt(
        AppointmentStatus.CANCELLED,
        ADMIN,
        new Date("2026-09-07T00:15:00.000Z"),
      ),
    ).not.toThrow();
  });

  it("lets the owning dentist cancel at any time", () => {
    expect(
      attempt(AppointmentStatus.CANCELLED, DENTIST, JUST_INSIDE),
    ).not.toThrow();
  });

  it("applies the same rule from CONFIRMED", () => {
    const confirmed = { status: AppointmentStatus.CONFIRMED };
    expect(
      attempt(AppointmentStatus.CANCELLED, PATIENT, WELL_BEFORE, confirmed),
    ).not.toThrow();
    expect(
      attempt(AppointmentStatus.CANCELLED, PATIENT, JUST_INSIDE, confirmed),
    ).toThrow(ValidationError);
  });
});

describe("assertTransitionAllowed — CONFIRMED → COMPLETED", () => {
  const confirmed = { status: AppointmentStatus.CONFIRMED };

  it("allows an admin once the appointment has finished", () => {
    expect(
      attempt(AppointmentStatus.COMPLETED, ADMIN, END_UTC, confirmed),
    ).not.toThrow();
  });

  it("allows the owning dentist", () => {
    expect(
      attempt(AppointmentStatus.COMPLETED, DENTIST, END_UTC, confirmed),
    ).not.toThrow();
  });

  it("refuses before the appointment has finished", () => {
    const oneMsEarly = new Date(END_UTC.getTime() - 1);
    expect(
      attempt(AppointmentStatus.COMPLETED, ADMIN, oneMsEarly, confirmed),
    ).toThrow(ValidationError);
    expect(
      attempt(AppointmentStatus.COMPLETED, ADMIN, oneMsEarly, confirmed),
    ).toThrow(/has not finished/i);
  });

  it("refuses the patient outright", () => {
    expect(
      attempt(AppointmentStatus.COMPLETED, PATIENT, END_UTC, confirmed),
    ).toThrow(ForbiddenError);
  });

  it("refuses another dentist", () => {
    expect(
      attempt(AppointmentStatus.COMPLETED, OTHER_DENTIST, END_UTC, confirmed),
    ).toThrow(NotFoundError);
  });
});

describe("assertTransitionAllowed — illegal edges", () => {
  it("refuses PENDING → COMPLETED, which must pass through CONFIRMED", () => {
    expect(attempt(AppointmentStatus.COMPLETED, ADMIN, END_UTC)).toThrow(
      ValidationError,
    );
  });

  it("refuses CONFIRMED → PENDING", () => {
    expect(
      attempt(AppointmentStatus.PENDING, ADMIN, WELL_BEFORE, {
        status: AppointmentStatus.CONFIRMED,
      }),
    ).toThrow(ValidationError);
  });

  it("refuses a no-op transition to the current status", () => {
    expect(attempt(AppointmentStatus.PENDING, ADMIN, WELL_BEFORE)).toThrow(
      /already pending/i,
    );
  });

  it("treats CANCELLED as terminal, even for an admin", () => {
    for (const to of [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
    ]) {
      expect(
        attempt(to, ADMIN, WELL_BEFORE, {
          status: AppointmentStatus.CANCELLED,
        }),
      ).toThrow(/no longer be changed/i);
    }
  });

  it("treats COMPLETED as terminal", () => {
    expect(
      attempt(AppointmentStatus.CANCELLED, ADMIN, END_UTC, {
        status: AppointmentStatus.COMPLETED,
      }),
    ).toThrow(/no longer be changed/i);
  });
});

describe("assertTransitionAllowed — ownership", () => {
  it("hides another patient's appointment behind NotFound, not Forbidden", () => {
    expect(
      attempt(AppointmentStatus.CANCELLED, OTHER_PATIENT, WELL_BEFORE),
    ).toThrow(NotFoundError);
  });

  it("checks ownership before state, so a stranger cannot probe status", () => {
    // A cancelled appointment would otherwise answer "already cancelled",
    // confirming it exists. Ownership is checked first, so it answers NotFound.
    expect(
      attempt(AppointmentStatus.CANCELLED, OTHER_PATIENT, WELL_BEFORE, {
        status: AppointmentStatus.CANCELLED,
      }),
    ).toThrow(NotFoundError);
  });

  it("lets an admin act on anyone's appointment", () => {
    expect(
      attempt(AppointmentStatus.CONFIRMED, ADMIN, WELL_BEFORE, {
        patientId: "someone-else",
      }),
    ).not.toThrow();
  });
});
