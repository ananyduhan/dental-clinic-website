import { AppointmentStatus } from "@prisma/client";

import {
  appointmentDateFromKey,
  appointmentInterval,
} from "@/lib/appointments/time";
import {
  CLINIC_TIMEZONE,
  REMINDER_WINDOW_END_HOURS,
  REMINDER_WINDOW_START_HOURS,
} from "@/lib/constants";
import { sendAppointmentReminderEmail } from "@/lib/email";
import { reportServerError } from "@/lib/errors";
import { formatClinicDate, formatClinicTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { utcToClinicDateKey } from "@/lib/slots";
import { sendWhatsAppReminder } from "@/lib/whatsapp";

/**
 * The day-ahead reminder sweep, run once a day by Vercel Cron.
 *
 * See docs/booking-flow.md, "Reminders". The rules that matter:
 *
 *  - Only PENDING and CONFIRMED appointments starting 24-48 hours from now.
 *  - WhatsApp first, then email. A failure in either is logged and the other
 *    still goes out.
 *  - `reminderSent` is set even when both providers fail. Reminders are never
 *    retried: a reminder that arrives late is worse than one that never
 *    arrives, so delivery is deliberately at-most-once and ops gets an alert.
 */

export type ReminderOutcome = {
  appointmentId: string;
  whatsappOk: boolean;
  emailOk: boolean;
  skipped?: "no-phone" | "already-claimed";
};

export type ReminderSweepResult = {
  /** Appointments in the window before claiming. */
  scanned: number;
  /** Appointments this run took responsibility for. */
  claimed: number;
  /** At least one provider delivered. */
  delivered: number;
  /** Claimed, but neither provider delivered — these need a human. */
  undelivered: number;
  outcomes: ReminderOutcome[];
};

export async function runReminderSweep(
  options: { now?: Date; timezone?: string } = {},
): Promise<ReminderSweepResult> {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? CLINIC_TIMEZONE;

  const windowStart = addHours(now, REMINDER_WINDOW_START_HOURS);
  const windowEnd = addHours(now, REMINDER_WINDOW_END_HOURS);

  const candidates = await findCandidates(windowStart, windowEnd, timezone);

  const outcomes: ReminderOutcome[] = [];
  let claimed = 0;
  let delivered = 0;
  let undelivered = 0;

  for (const appointment of candidates) {
    // Claim before sending: a conditional update on `reminder_sent = false`.
    // Whichever run wins gets exactly one row; a concurrent or retried
    // invocation matches zero and moves on, so nobody is messaged twice.
    const claim = await prisma.appointment.updateMany({
      where: { id: appointment.id, reminderSent: false },
      data: { reminderSent: true },
    });

    if (claim.count === 0) {
      outcomes.push({
        appointmentId: appointment.id,
        whatsappOk: false,
        emailOk: false,
        skipped: "already-claimed",
      });
      continue;
    }

    claimed += 1;

    const details = {
      patientName: appointment.patient.firstName,
      dentistName: `Dr. ${appointment.dentist.user.firstName} ${appointment.dentist.user.lastName}`,
      service: appointment.service.name,
      date: formatClinicDate(appointment.appointmentDate),
      time: formatClinicTime(appointment.startTime),
    };

    const whatsappOk = appointment.patient.phone
      ? await attempt("whatsapp", appointment.id, () =>
          sendWhatsAppReminder(appointment.patient.phone!, details),
        )
      : false;

    const emailOk = await attempt("email", appointment.id, () =>
      sendAppointmentReminderEmail(appointment.patient.email, details),
    );

    if (whatsappOk || emailOk) {
      delivered += 1;
    } else {
      undelivered += 1;
      // Nobody was reached and the appointment is now marked as reminded.
      // This is the case ops has to pick up by phone.
      reportServerError(
        new Error(`Reminder undelivered for appointment ${appointment.id}`),
        { route: "/api/cron/reminders", appointmentId: appointment.id },
      );
    }

    const outcome: ReminderOutcome = {
      appointmentId: appointment.id,
      whatsappOk,
      emailOk,
      ...(appointment.patient.phone ? {} : { skipped: "no-phone" as const }),
    };
    outcomes.push(outcome);

    // docs/booking-flow.md, "Observability".
    console.info("[reminders] reminderSent", outcome);
  }

  return {
    scanned: candidates.length,
    claimed,
    delivered,
    undelivered,
    outcomes,
  };
}

/**
 * Appointments starting inside the window.
 *
 * `appointments` stores a clinic-local calendar date and an `"HH:mm"` wall
 * clock, not an instant, so the window cannot be expressed as a single SQL
 * range. The query narrows to the one or two clinic dates the window can touch,
 * then each candidate's real start instant is computed and range-checked in
 * memory. At clinic scale that is a handful of rows.
 */
async function findCandidates(
  windowStart: Date,
  windowEnd: Date,
  timezone: string,
) {
  // Every clinic date the window touches, not just its two endpoints. Taking
  // only the endpoints was correct while the window was two hours wide, but it
  // skips the middle day the moment the span exceeds 24 hours — a silent
  // whole-day gap in reminders. Walking the range costs nothing at this size
  // and removes the trap.
  const dateKeys: string[] = [];
  for (
    let cursor = new Date(windowStart);
    cursor <= windowEnd;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const key = utcToClinicDateKey(cursor, timezone);
    if (!dateKeys.includes(key)) dateKeys.push(key);
  }
  const endKey = utcToClinicDateKey(windowEnd, timezone);
  if (!dateKeys.includes(endKey)) dateKeys.push(endKey);

  const candidates = await prisma.appointment.findMany({
    where: {
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      reminderSent: false,
      appointmentDate: { in: dateKeys.map(appointmentDateFromKey) },
    },
    include: {
      patient: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      dentist: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      service: { select: { name: true } },
    },
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
  });

  return candidates.filter((appointment) => {
    const { startUtc } = appointmentInterval(appointment, timezone);
    return startUtc >= windowStart && startUtc < windowEnd;
  });
}

/**
 * Run one provider, converting a failure into `false`.
 *
 * A provider outage must not stop the sweep or the other channel — that is the
 * whole point of the "log it and continue" rule.
 */
async function attempt(
  channel: "whatsapp" | "email",
  appointmentId: string,
  send: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (error) {
    console.error(`[reminders] ${channel} failed`, { appointmentId, error });
    reportServerError(error, {
      route: "/api/cron/reminders",
      appointmentId,
      channel,
    });
    return false;
  }
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
