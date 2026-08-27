import { AppointmentStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAppointment,
  transitionAppointment,
  type Actor,
} from "@/lib/appointments";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import {
  TEST_DATE,
  TEST_NOW,
  TZ,
  createScenario,
  destroyScenario,
  hasDatabase,
  type Scenario,
} from "./helpers";

/** 09:00 Sydney on 2027-03-01 is 22:00Z the previous day (AEDT, +11). */
const APPOINTMENT_START = new Date("2027-02-28T22:00:00.000Z");

describe.skipIf(!hasDatabase)("booking.transition", () => {
  let scenario: Scenario;
  let admin: Actor;
  let patient: Actor;
  let dentist: Actor;
  let otherDentist: Actor;

  beforeAll(async () => {
    scenario = await createScenario("transition");
    admin = { role: "ADMIN", userId: "admin-fixture" };
    patient = { role: "PATIENT", userId: scenario.patientId };
    dentist = {
      role: "DENTIST",
      userId: "unused",
      dentistId: scenario.dentistId,
    };
    otherDentist = {
      role: "DENTIST",
      userId: "unused",
      dentistId: scenario.secondDentistId,
    };
  });

  afterAll(async () => {
    await destroyScenario(scenario);
    await prisma.$disconnect();
  });

  let seq = 0;
  async function freshAppointment() {
    // A distinct slot per test, so no two contend for the same row. Stepped by
    // 30 minutes rather than an hour so the 09:00-17:00 roster has room for all
    // of them; back-to-back slots do not overlap, so they never collide.
    const minutesFromNine = seq++ * 30;
    const startTime = [
      String(9 + Math.floor(minutesFromNine / 60)).padStart(2, "0"),
      String(minutesFromNine % 60).padStart(2, "0"),
    ].join(":");
    return createAppointment({
      patientId: scenario.patientId,
      dentistId: scenario.dentistId,
      serviceId: scenario.serviceId,
      appointmentDate: TEST_DATE,
      startTime,
      now: TEST_NOW,
      timezone: TZ,
    });
  }

  it("persists an admin confirmation", async () => {
    const appointment = await freshAppointment();

    const updated = await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.CONFIRMED,
      actor: admin,
      now: TEST_NOW,
      timezone: TZ,
    });

    expect(updated.status).toBe("CONFIRMED");
    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(stored.status).toBe("CONFIRMED");
  });

  it("lets the owning dentist confirm, and hides the appointment from another", async () => {
    const appointment = await freshAppointment();

    await expect(
      transitionAppointment({
        appointmentId: appointment.id,
        to: AppointmentStatus.CONFIRMED,
        actor: otherDentist,
        now: TEST_NOW,
        timezone: TZ,
      }),
    ).rejects.toThrow(NotFoundError);

    const updated = await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.CONFIRMED,
      actor: dentist,
      now: TEST_NOW,
      timezone: TZ,
    });
    expect(updated.status).toBe("CONFIRMED");
  });

  it("lets a patient cancel well in advance", async () => {
    const appointment = await freshAppointment();

    const updated = await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.CANCELLED,
      actor: patient,
      now: TEST_NOW,
      timezone: TZ,
    });

    expect(updated.status).toBe("CANCELLED");
  });

  it("refuses a patient cancelling inside 24 hours, leaving the row untouched", async () => {
    const appointment = await freshAppointment();
    const insideWindow = new Date(APPOINTMENT_START.getTime() - 60 * 60 * 1000);

    await expect(
      transitionAppointment({
        appointmentId: appointment.id,
        to: AppointmentStatus.CANCELLED,
        actor: patient,
        now: insideWindow,
        timezone: TZ,
      }),
    ).rejects.toThrow(ValidationError);

    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(stored.status).toBe("PENDING");
  });

  it("lets an admin cancel inside 24 hours", async () => {
    const appointment = await freshAppointment();

    const updated = await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.CANCELLED,
      actor: admin,
      now: new Date(APPOINTMENT_START.getTime() - 60 * 1000),
      timezone: TZ,
    });

    expect(updated.status).toBe("CANCELLED");
  });

  it("refuses completion before the appointment has finished", async () => {
    const appointment = await freshAppointment();
    await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.CONFIRMED,
      actor: admin,
      now: TEST_NOW,
      timezone: TZ,
    });

    await expect(
      transitionAppointment({
        appointmentId: appointment.id,
        to: AppointmentStatus.COMPLETED,
        actor: admin,
        now: TEST_NOW,
        timezone: TZ,
      }),
    ).rejects.toThrow(/has not finished/i);
  });

  it("completes once the appointment is over, and records admin notes", async () => {
    const appointment = await freshAppointment();
    await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.CONFIRMED,
      actor: admin,
      now: TEST_NOW,
      timezone: TZ,
    });

    const afterwards = new Date("2027-03-02T00:00:00.000Z");
    const updated = await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.COMPLETED,
      actor: admin,
      adminNotes: "Routine visit, no issues",
      now: afterwards,
      timezone: TZ,
    });

    expect(updated.status).toBe("COMPLETED");
    expect(updated.adminNotes).toBe("Routine visit, no issues");
  });

  it("treats a cancelled appointment as terminal", async () => {
    const appointment = await freshAppointment();
    await transitionAppointment({
      appointmentId: appointment.id,
      to: AppointmentStatus.CANCELLED,
      actor: admin,
      now: TEST_NOW,
      timezone: TZ,
    });

    await expect(
      transitionAppointment({
        appointmentId: appointment.id,
        to: AppointmentStatus.CONFIRMED,
        actor: admin,
        now: TEST_NOW,
        timezone: TZ,
      }),
    ).rejects.toThrow(/no longer be changed/i);
  });

  it("lets only one of two simultaneous status changes land", async () => {
    // Two admins, one clicking Confirm and one Cancel. The compare-and-swap on
    // the expected status is what stops the second silently overwriting.
    const appointment = await freshAppointment();

    const results = await Promise.allSettled([
      transitionAppointment({
        appointmentId: appointment.id,
        to: AppointmentStatus.CONFIRMED,
        actor: admin,
        now: TEST_NOW,
        timezone: TZ,
      }),
      transitionAppointment({
        appointmentId: appointment.id,
        to: AppointmentStatus.CANCELLED,
        actor: admin,
        now: TEST_NOW,
        timezone: TZ,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
  });

  it("refuses to touch an appointment that does not exist", async () => {
    await expect(
      transitionAppointment({
        appointmentId: "00000000-0000-4000-8000-000000000000",
        to: AppointmentStatus.CONFIRMED,
        actor: admin,
        now: TEST_NOW,
        timezone: TZ,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
