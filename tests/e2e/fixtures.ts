import { AppointmentStatus } from "@prisma/client";
import type { Page } from "@playwright/test";

import { appointmentDateFromKey, endTimeFor } from "@/lib/appointments";
import { prisma } from "@/lib/prisma";
import { utcToClinicDateKey, utcToClinicTime } from "@/lib/slots";

/**
 * Shared helpers for the e2e suites.
 *
 * These run against the seeded demo accounts and the live database, so anything
 * they create is tagged and removed again — see `cleanupE2EData`.
 */

export const CLINIC_TZ = process.env.CLINIC_TIMEZONE ?? "Australia/Sydney";

export const PATIENT = { email: "patient1@demo.com", password: "Patient123!" };
export const ADMIN = { email: "admin@demo.com", password: "Admin123!" };

/** Every row these tests create carries this marker, so teardown is exact. */
export const E2E_MARKER = "E2E TEST";

export async function signIn(
  page: Page,
  who: { email: string; password: string },
) {
  await page.goto("/login");
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click('button[type="submit"]');
  // Sign-in lands on the dashboard for patients, /admin for staff.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}

/**
 * Insert an appointment directly, bypassing the booking flow.
 *
 * Used for states the UI cannot reach quickly — notably an appointment less
 * than 24 hours away, which the slot generator would never offer.
 */
export async function seedAppointment(options: {
  hoursFromNow: number;
  status?: AppointmentStatus;
}) {
  const at = new Date(Date.now() + options.hoursFromNow * 60 * 60 * 1000);
  const dateKey = utcToClinicDateKey(at, CLINIC_TZ);
  const startTime = utcToClinicTime(at, CLINIC_TZ);

  const [patient, dentist, service] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: PATIENT.email } }),
    prisma.dentist.findFirstOrThrow({ where: { isActive: true } }),
    prisma.service.findFirstOrThrow({ where: { isActive: true } }),
  ]);

  return prisma.appointment.create({
    data: {
      patientId: patient.id,
      dentistId: dentist.id,
      serviceId: service.id,
      appointmentDate: appointmentDateFromKey(dateKey),
      startTime,
      endTime: endTimeFor(
        dateKey,
        startTime,
        service.durationMinutes,
        CLINIC_TZ,
      ),
      status: options.status ?? AppointmentStatus.CONFIRMED,
      adminNotes: E2E_MARKER,
    },
  });
}

/** Remove everything the suites created, whether seeded or booked through the UI. */
export async function cleanupE2EData() {
  await prisma.appointment.deleteMany({
    where: {
      OR: [{ adminNotes: E2E_MARKER }, { notes: { contains: E2E_MARKER } }],
    },
  });
}

export { prisma };
