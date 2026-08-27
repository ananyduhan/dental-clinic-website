import { AppointmentStatus } from "@prisma/client";

import { appointmentDateFromKey } from "@/lib/appointments/time";
import { prisma } from "@/lib/prisma";
import { utcToClinicDateKey } from "@/lib/slots";
import type { DashboardStats } from "@/types";

/**
 * Admin dashboard counters.
 *
 * "Today" and "this week" are clinic-local, not UTC — an admin in Sydney
 * opening the dashboard at 09:00 means their day, and `appointment_date` stores
 * the clinic-local calendar date.
 */
export async function getDashboardStats(
  now: Date = new Date(),
): Promise<DashboardStats> {
  const today = appointmentDateFromKey(utcToClinicDateKey(now));
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    todaysAppointments,
    totalPatients,
    pendingConfirmations,
    cancellationsThisWeek,
  ] = await Promise.all([
    prisma.appointment.count({
      where: {
        appointmentDate: today,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
    }),
    prisma.user.count({ where: { role: "PATIENT" } }),
    prisma.appointment.count({
      where: {
        status: AppointmentStatus.PENDING,
        // Only future ones need attention; a past unconfirmed appointment is
        // a records problem, not a queue the front desk should be working.
        appointmentDate: { gte: today },
      },
    }),
    prisma.appointment.count({
      where: {
        status: AppointmentStatus.CANCELLED,
        updatedAt: { gte: weekAgo },
      },
    }),
  ]);

  return {
    todaysAppointments,
    totalPatients,
    pendingConfirmations,
    cancellationsThisWeek,
  };
}

/** The clinic-local calendar date of an instant, for "today" filters. */
export function todayInClinic(now: Date = new Date()): Date {
  return appointmentDateFromKey(utcToClinicDateKey(now));
}
