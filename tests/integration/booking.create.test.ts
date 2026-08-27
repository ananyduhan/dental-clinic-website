import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAppointment } from "@/lib/appointments";
import {
  ConflictError,
  NotFoundError,
  SlotNoLongerAvailableError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import {
  TEST_DATE,
  TEST_NOW,
  TEST_SUNDAY,
  TZ,
  createScenario,
  destroyScenario,
  hasDatabase,
  type Scenario,
} from "./helpers";

describe.skipIf(!hasDatabase)("booking.create", () => {
  let scenario: Scenario;

  beforeAll(async () => {
    scenario = await createScenario("create");
  });

  afterAll(async () => {
    await destroyScenario(scenario);
    await prisma.$disconnect();
  });

  function book(overrides: Record<string, unknown> = {}) {
    return createAppointment({
      patientId: scenario.patientId,
      dentistId: scenario.dentistId,
      serviceId: scenario.serviceId,
      appointmentDate: TEST_DATE,
      startTime: "09:00",
      now: TEST_NOW,
      timezone: TZ,
      ...overrides,
    });
  }

  it("creates a PENDING appointment with the end time derived from the service", async () => {
    const appointment = await book({ startTime: "09:00" });

    expect(appointment.status).toBe("PENDING");
    expect(appointment.startTime).toBe("09:00");
    // The fixture service is 30 minutes.
    expect(appointment.endTime).toBe("09:30");
    expect(appointment.dentistId).toBe(scenario.dentistId);
    expect(appointment.reminderSent).toBe(false);
  });

  it("refuses a slot the generator does not offer", async () => {
    // The fixture roster starts at 09:00.
    await expect(book({ startTime: "08:00" })).rejects.toThrow(
      SlotNoLongerAvailableError,
    );
  });

  it("refuses a slot in the past", async () => {
    await expect(
      book({ startTime: "10:00", now: new Date("2027-06-01T00:00:00.000Z") }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses a patient whose email is not verified", async () => {
    const unverified = await prisma.user.create({
      data: {
        email: `itest-unverified-${Date.now()}@example.invalid`,
        firstName: "Un",
        lastName: "Verified",
        role: "PATIENT",
        emailVerified: false,
      },
    });
    scenario.userIds.push(unverified.id);

    await expect(
      book({ patientId: unverified.id, startTime: "10:30" }),
    ).rejects.toThrow(/verify your email/i);
  });

  it("lets an admin book on behalf of an unverified walk-in", async () => {
    const walkIn = await prisma.user.create({
      data: {
        email: `itest-walkin-${Date.now()}@example.invalid`,
        firstName: "Walk",
        lastName: "In",
        role: "PATIENT",
        emailVerified: false,
      },
    });
    scenario.userIds.push(walkIn.id);

    const appointment = await book({
      patientId: walkIn.id,
      startTime: "11:00",
      bookedByAdmin: true,
    });
    expect(appointment.status).toBe("PENDING");
  });

  it("refuses a deactivated service", async () => {
    const retired = await prisma.service.create({
      data: {
        name: `itest-retired-${Date.now()}`,
        durationMinutes: 30,
        description: "retired",
        isActive: false,
      },
    });

    await expect(
      book({ serviceId: retired.id, startTime: "12:00" }),
    ).rejects.toThrow(/no longer offered/i);

    await prisma.service.delete({ where: { id: retired.id } });
  });

  it("refuses a deactivated dentist", async () => {
    await prisma.dentist.update({
      where: { id: scenario.secondDentistId },
      data: { isActive: false },
    });

    await expect(
      book({ dentistId: scenario.secondDentistId, startTime: "12:30" }),
    ).rejects.toThrow(/no longer available/i);

    await prisma.dentist.update({
      where: { id: scenario.secondDentistId },
      data: { isActive: true },
    });
  });

  it("refuses an unknown dentist or service", async () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    await expect(
      book({ dentistId: missing, startTime: "13:00" }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      book({ serviceId: missing, startTime: "13:00" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("stops a patient double-booking themselves with a different dentist", async () => {
    await book({ startTime: "14:00" });

    await expect(
      book({ dentistId: scenario.secondDentistId, startTime: "14:00" }),
    ).rejects.toThrow(ConflictError);
  });

  it("allows back-to-back appointments for the same dentist", async () => {
    const first = await book({ startTime: "15:00" });
    const second = await book({
      patientId: scenario.secondPatientId,
      startTime: "15:30",
    });

    expect(first.endTime).toBe("15:30");
    expect(second.startTime).toBe("15:30");
  });

  describe('"no preference" dentist selection', () => {
    // Sunday: only the two fixture dentists are rostered, so the choice is not
    // at the mercy of whatever the seed contains.
    function bookAnyone(startTime: string, patientId = scenario.patientId) {
      return createAppointment({
        patientId,
        dentistId: null,
        serviceId: scenario.serviceId,
        appointmentDate: TEST_SUNDAY,
        startTime,
        now: TEST_NOW,
        timezone: TZ,
      });
    }

    it("breaks a tie deterministically by dentist id", async () => {
      const appointment = await bookAnyone("09:00");
      const lowest = [scenario.dentistId, scenario.secondDentistId].sort(
        (a, b) => a.localeCompare(b),
      )[0];

      expect(appointment.dentistId).toBe(lowest);
    });

    it("then balances onto the dentist with fewer appointments that day", async () => {
      // The 09:00 booking above loaded one of the two; the next should land on
      // the other rather than piling onto the same dentist.
      const first = await prisma.appointment.findFirstOrThrow({
        where: {
          appointmentDate: new Date(`${TEST_SUNDAY}T00:00:00.000Z`),
          startTime: "09:00",
        },
      });

      const second = await bookAnyone("10:00", scenario.secondPatientId);
      expect(second.dentistId).not.toBe(first.dentistId);
    });
  });
});
