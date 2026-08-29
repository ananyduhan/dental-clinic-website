import { AppointmentStatus } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { appointmentDateFromKey, endTimeFor } from "@/lib/appointments";
import { prisma } from "@/lib/prisma";
import { runReminderSweep } from "@/lib/reminders";
import { clinicTimeToUtc } from "@/lib/slots";

import {
  TZ,
  createScenario,
  destroyScenario,
  hasDatabase,
  type Scenario,
} from "./helpers";

/**
 * The reminder sweep against a real database.
 *
 * `now` is injected, so instead of moving appointments around we move the clock:
 * every case books the same 10:00 slot and asks what the sweep does from a
 * different vantage point.
 */
describe.skipIf(!hasDatabase)("reminders", () => {
  let scenario: Scenario;

  /** A Monday the fixtures are rostered for. */
  const DATE = "2027-03-01";
  const START = "10:00";
  /** 10:00 Sydney on 2027-03-01 is 23:00Z the previous day (AEDT, +11). */
  const startUtc = clinicTimeToUtc(DATE, START, TZ);

  beforeAll(async () => {
    scenario = await createScenario("reminders");
  });

  afterAll(async () => {
    await destroyScenario(scenario);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.appointment.deleteMany({
      where: { dentistId: scenario.dentistId },
    });
  });

  async function bookRaw(
    overrides: {
      status?: AppointmentStatus;
      reminderSent?: boolean;
      startTime?: string;
    } = {},
  ) {
    const startTime = overrides.startTime ?? START;
    return prisma.appointment.create({
      data: {
        patientId: scenario.patientId,
        dentistId: scenario.dentistId,
        serviceId: scenario.serviceId,
        appointmentDate: appointmentDateFromKey(DATE),
        startTime,
        endTime: endTimeFor(DATE, startTime, 30, TZ),
        status: overrides.status ?? AppointmentStatus.CONFIRMED,
        reminderSent: overrides.reminderSent ?? false,
      },
    });
  }

  /** An instant `hours` before the appointment starts. */
  function hoursBefore(hours: number): Date {
    return new Date(startUtc.getTime() - hours * 60 * 60 * 1000);
  }

  it("reminds an appointment 24 hours out", async () => {
    const appointment = await bookRaw();

    const result = await runReminderSweep({
      now: hoursBefore(24),
      timezone: TZ,
    });

    expect(result.claimed).toBe(1);
    expect(result.outcomes[0].appointmentId).toBe(appointment.id);

    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(stored.reminderSent).toBe(true);
  });

  it("includes the edges of the 24-48 hour window and excludes outside it", async () => {
    for (const [hours, shouldRemind] of [
      [24, true],
      [30, true],
      [47.9, true],
      [23.9, false],
      [48, false],
      [50, false],
      [2, false],
    ] as const) {
      await prisma.appointment.deleteMany({
        where: { dentistId: scenario.dentistId },
      });
      await bookRaw();

      const result = await runReminderSweep({
        now: hoursBefore(hours),
        timezone: TZ,
      });

      expect(
        result.claimed,
        `${hours}h before should ${shouldRemind ? "" : "not "}remind`,
      ).toBe(shouldRemind ? 1 : 0);
    }
  });

  it("does not remind a cancelled appointment", async () => {
    await bookRaw({ status: AppointmentStatus.CANCELLED });

    const result = await runReminderSweep({
      now: hoursBefore(24),
      timezone: TZ,
    });
    expect(result.claimed).toBe(0);
  });

  it("does not remind a completed appointment", async () => {
    await bookRaw({ status: AppointmentStatus.COMPLETED });

    const result = await runReminderSweep({
      now: hoursBefore(24),
      timezone: TZ,
    });
    expect(result.claimed).toBe(0);
  });

  it("reminds a PENDING appointment, not just a CONFIRMED one", async () => {
    await bookRaw({ status: AppointmentStatus.PENDING });

    const result = await runReminderSweep({
      now: hoursBefore(24),
      timezone: TZ,
    });
    expect(result.claimed).toBe(1);
  });

  it("skips an appointment already marked as reminded", async () => {
    await bookRaw({ reminderSent: true });

    const result = await runReminderSweep({
      now: hoursBefore(24),
      timezone: TZ,
    });
    expect(result.scanned).toBe(0);
    expect(result.claimed).toBe(0);
  });

  it("does not double-send when the sweep runs twice in the same hour", async () => {
    // The idempotency gate: a Vercel Cron retry inside the same window must not
    // message the patient again.
    await bookRaw();
    const now = hoursBefore(24);

    const first = await runReminderSweep({ now, timezone: TZ });
    const second = await runReminderSweep({ now, timezone: TZ });

    expect(first.claimed).toBe(1);
    expect(second.claimed).toBe(0);
  });

  it("does not double-send when two sweeps run concurrently", async () => {
    // The claim is a conditional update, so only one invocation can win the row
    // even if Vercel fires overlapping executions.
    await bookRaw();
    const now = hoursBefore(24);

    const [a, b] = await Promise.all([
      runReminderSweep({ now, timezone: TZ }),
      runReminderSweep({ now, timezone: TZ }),
    ]);

    expect(a.claimed + b.claimed).toBe(1);
  });

  it("marks the reminder sent even though WhatsApp is unconfigured", async () => {
    // Twilio has no credentials in this environment, so the WhatsApp send
    // throws and the email fallback carries it — exactly the documented
    // "log the failure, still send the other, still flip the flag" path.
    const appointment = await bookRaw();

    const result = await runReminderSweep({
      now: hoursBefore(24),
      timezone: TZ,
    });

    expect(result.outcomes[0].whatsappOk).toBe(false);
    expect(result.outcomes[0].emailOk).toBe(true);
    expect(result.delivered).toBe(1);
    expect(result.undelivered).toBe(0);

    const stored = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(stored.reminderSent).toBe(true);
  });

  it("sweeps a whole day of appointments in one run", async () => {
    await bookRaw({ startTime: "10:00" });
    await bookRaw({ startTime: "11:00" });
    await bookRaw({ startTime: "14:00" });

    // This is the point of the 24-48h window: one daily sweep has to cover
    // every appointment in the following day. Under the old 23-25h window this
    // same run claimed only the 10:00 one and the other two needed later runs
    // that a daily cron would never make.
    const result = await runReminderSweep({
      now: hoursBefore(24),
      timezone: TZ,
    });
    expect(result.claimed).toBe(3);

    // And the next day's sweep finds nothing left to do.
    const later = await runReminderSweep({
      now: new Date(hoursBefore(24).getTime() + 24 * 60 * 60 * 1000),
      timezone: TZ,
    });
    expect(later.claimed).toBe(0);
  });
});
