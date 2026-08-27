import { ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { appointmentDateFromKey } from "@/lib/appointments/time";
import type {
  CreateBlockedDateInput,
  UpdateAvailabilityInput,
} from "@/lib/validators/dentist";

/**
 * Weekly rosters and blocked dates.
 *
 * The slot generator reads both. Nothing here cancels an existing appointment:
 * per docs/booking-flow.md, blocking a date prevents *new* bookings and an
 * admin has to cancel anything already on the books explicitly.
 */

export async function getAvailability(dentistId: string) {
  return prisma.availability.findMany({
    where: { dentistId },
    orderBy: { dayOfWeek: "asc" },
  });
}

/**
 * Replace a dentist's whole weekly roster.
 *
 * A wholesale replace rather than per-row edits: the admin UI presents the week
 * as one form, and `@@unique([dentistId, dayOfWeek])` makes partial updates
 * fiddly for no benefit. Done in a transaction so a failure cannot leave a
 * dentist with no roster at all.
 */
export async function setAvailability(
  dentistId: string,
  input: UpdateAvailabilityInput,
) {
  for (const row of input.availability) {
    if (row.endTime <= row.startTime) {
      throw new ValidationError(
        `${row.dayOfWeek}: the finish time must be later than the start time`,
        {
          [`availability.${row.dayOfWeek}`]:
            "Finish time must be after start time",
        },
      );
    }
  }

  const days = input.availability.map((row) => row.dayOfWeek);
  if (new Set(days).size !== days.length) {
    throw new ValidationError("Each day can only appear once in the roster");
  }

  return prisma.$transaction(async (tx) => {
    await tx.availability.deleteMany({ where: { dentistId } });
    if (input.availability.length > 0) {
      await tx.availability.createMany({
        data: input.availability.map((row) => ({ ...row, dentistId })),
      });
    }
    return tx.availability.findMany({
      where: { dentistId },
      orderBy: { dayOfWeek: "asc" },
    });
  });
}

export async function listBlockedDates(dentistId: string) {
  return prisma.blockedDate.findMany({
    where: { dentistId },
    orderBy: { date: "asc" },
  });
}

/**
 * Block a date, reporting any appointments already on it.
 *
 * Idempotent on `(dentistId, date)` — re-blocking an already-blocked day
 * updates the reason rather than failing on the unique constraint.
 */
export async function blockDate(input: CreateBlockedDateInput) {
  const date = appointmentDateFromKey(input.date);

  const clashing = await prisma.appointment.count({
    where: {
      dentistId: input.dentistId,
      appointmentDate: date,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });

  const blocked = await prisma.blockedDate.upsert({
    where: { dentistId_date: { dentistId: input.dentistId, date } },
    create: { dentistId: input.dentistId, date, reason: input.reason },
    update: { reason: input.reason },
  });

  return { blocked, clashingAppointments: clashing };
}

export async function unblockDate(blockedDateId: string) {
  await prisma.blockedDate.delete({ where: { id: blockedDateId } });
}
