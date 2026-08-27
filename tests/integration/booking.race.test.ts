import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAppointment } from "@/lib/appointments";
import { ConflictError, SlotNoLongerAvailableError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import {
  TEST_DATE,
  TEST_NOW,
  TZ,
  activeAppointmentsFor,
  createScenario,
  destroyScenario,
  hasDatabase,
  type Scenario,
} from "./helpers";

/**
 * The most important test in the codebase, per the completion plan: two
 * patients hitting Confirm on the same slot at the same moment.
 *
 * Note the two bookings use *different* patients. With the same patient the
 * "you already have an appointment then" check would reject the second one on
 * its own, and the test would pass without ever exercising the race layers.
 */
describe.skipIf(!hasDatabase)("booking.race", () => {
  let scenario: Scenario;

  beforeAll(async () => {
    scenario = await createScenario("race");
  });

  afterAll(async () => {
    await destroyScenario(scenario);
    await prisma.$disconnect();
  });

  function book(patientId: string, startTime: string) {
    return createAppointment({
      patientId,
      dentistId: scenario.dentistId,
      serviceId: scenario.serviceId,
      appointmentDate: TEST_DATE,
      startTime,
      now: TEST_NOW,
      timezone: TZ,
    });
  }

  it("lets exactly one of two simultaneous bookings win the same slot", async () => {
    const results = await Promise.allSettled([
      book(scenario.patientId, "09:00"),
      book(scenario.secondPatientId, "09:00"),
    ]);

    const won = results.filter((result) => result.status === "fulfilled");
    const lost = results.filter((result) => result.status === "rejected");

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    // The loser gets a conflict the UI can act on — not an unhandled 500.
    const error = (lost[0] as PromiseRejectedResult).reason;
    expect(
      error instanceof ConflictError ||
        error instanceof SlotNoLongerAvailableError,
    ).toBe(true);

    // And the database holds exactly one appointment for that slot.
    const rows = await activeAppointmentsFor(scenario.dentistId);
    expect(rows.filter((row) => row.startTime === "09:00")).toHaveLength(1);
  });

  it("holds under a wider stampede", async () => {
    const patients = [scenario.patientId, scenario.secondPatientId];
    const results = await Promise.allSettled([
      book(patients[0], "11:00"),
      book(patients[1], "11:00"),
      book(patients[0], "11:00"),
      book(patients[1], "11:00"),
      book(patients[0], "11:00"),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);

    const rows = await activeAppointmentsFor(scenario.dentistId);
    expect(rows.filter((row) => row.startTime === "11:00")).toHaveLength(1);
  });

  it("does not produce a false conflict between back-to-back slots", async () => {
    // 13:00-13:30 and 13:30-14:00 touch but do not overlap. Booked
    // concurrently, both must succeed — the strict inequalities in the overlap
    // test are what make this legal.
    const results = await Promise.allSettled([
      book(scenario.patientId, "13:00"),
      book(scenario.secondPatientId, "13:30"),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(2);

    const rows = await activeAppointmentsFor(scenario.dentistId);
    expect(rows.map((row) => row.startTime)).toEqual(
      expect.arrayContaining(["13:00", "13:30"]),
    );
  });

  it("frees the slot again once the winner cancels", async () => {
    // This is the Phase 0 partial-index fix paying off: an unconditional unique
    // index would have counted the CANCELLED row and locked the slot forever.
    const first = await book(scenario.patientId, "15:00");
    await prisma.appointment.update({
      where: { id: first.id },
      data: { status: "CANCELLED" },
    });

    const second = await book(scenario.secondPatientId, "15:00");
    expect(second.id).not.toBe(first.id);
    expect(second.startTime).toBe("15:00");
  });
});
