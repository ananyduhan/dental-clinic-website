import { AppointmentStatus } from "@prisma/client";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

/**
 * Patient records, for the admin and dentist views.
 *
 * Nothing here is reachable by a patient — the callers all sit behind
 * `requireRole('ADMIN', 'DENTIST')`.
 */

export type PatientHistoryEntry = {
  id: string;
  appointmentDate: Date;
  startTime: string;
  service: string;
  status: AppointmentStatus;
};

export type PatientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  createdAt: Date;
  appointmentCount: number;
  lastVisit: Date | null;
  /** Most recent appointments, newest first — the expandable row in the UI. */
  recentAppointments: PatientHistoryEntry[];
};

export type PatientListResult = {
  data: PatientSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function listPatients(
  filters: { search?: string; page?: number; limit?: number } = {},
): Promise<PatientListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(
    Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const search = filters.search?.trim();

  const where = {
    role: "PATIENT" as const,
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [patients, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { patientAppointments: true } },
        // One bounded query for the whole page rather than a fetch per row when
        // an admin expands one. Five is what the panel shows.
        patientAppointments: {
          select: {
            id: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            service: { select: { name: true } },
          },
          orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
          take: 5,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: patients.map(({ _count, patientAppointments, ...patient }) => ({
      ...patient,
      appointmentCount: _count.patientAppointments,
      lastVisit:
        patientAppointments.find(
          (appt) => appt.status === AppointmentStatus.COMPLETED,
        )?.appointmentDate ?? null,
      recentAppointments: patientAppointments.map((appt) => ({
        id: appt.id,
        appointmentDate: appt.appointmentDate,
        startTime: appt.startTime,
        service: appt.service.name,
        status: appt.status,
      })),
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
