import { AppointmentStatus, Prisma } from "@prisma/client";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { utcToClinicDateKey } from "@/lib/slots";

import { appointmentDateFromKey } from "./time";
import type { Actor } from "./transition";

/**
 * Appointment reads.
 *
 * The rule that matters here is the IDOR one from `CLAUDE.md`: a patient's
 * queries are filtered by `session.user.id`, never by a URL parameter. That is
 * why there is no bare `getAppointment(id)` in this module — every read is
 * scoped by the actor it is for.
 */

const APPOINTMENT_INCLUDE = {
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  dentist: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  service: true,
} satisfies Prisma.AppointmentInclude;

export type AppointmentListFilters = {
  status?: AppointmentStatus;
  /** Clinic-local "yyyy-MM-dd", inclusive. */
  from?: string;
  to?: string;
  dentistId?: string;
  page?: number;
  limit?: number;
};

export type PaginatedAppointments = {
  data: Awaited<ReturnType<typeof listAppointmentsFor>>["data"];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * List the appointments this actor is allowed to see.
 *
 * The scope is derived from the actor, not passed in — a caller cannot widen it
 * by supplying a different id.
 */
export async function listAppointmentsFor(
  actor: Actor,
  filters: AppointmentListFilters = {},
) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(
    Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const where: Prisma.AppointmentWhereInput = {
    ...scopeFor(actor),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? {
          appointmentDate: {
            ...(filters.from
              ? { gte: appointmentDateFromKey(filters.from) }
              : {}),
            ...(filters.to ? { lte: appointmentDateFromKey(filters.to) } : {}),
          },
        }
      : {}),
  };

  // An admin filtering by dentist is narrowing; a dentist cannot use this to
  // widen, because `scopeFor` has already pinned their own id and object spread
  // would let a later key win.
  if (filters.dentistId && actor.role === "ADMIN") {
    where.dentistId = filters.dentistId;
  }

  const [data, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: APPOINTMENT_INCLUDE,
      orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Fetch one appointment, scoped to the actor.
 *
 * A patient asking for someone else's appointment gets `NotFoundError`, not
 * `ForbiddenError` — "exists but is not yours" is itself information.
 */
export async function getAppointmentFor(actor: Actor, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, ...scopeFor(actor) },
    include: APPOINTMENT_INCLUDE,
  });

  if (!appointment) throw new NotFoundError("Appointment not found");
  return appointment;
}

/** Upcoming active appointments, soonest first — the patient dashboard view. */
export async function listUpcomingAppointmentsFor(
  actor: Actor,
  now: Date = new Date(),
) {
  return prisma.appointment.findMany({
    where: {
      ...scopeFor(actor),
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      // Date-level granularity is deliberate: an appointment later today is
      // still upcoming, and `appointment_date` is a date column.
      appointmentDate: { gte: appointmentDateFromKey(utcToClinicDateKey(now)) },
    },
    include: APPOINTMENT_INCLUDE,
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
  });
}

/** The `where` fragment that pins a query to what this actor may see. */
function scopeFor(actor: Actor): Prisma.AppointmentWhereInput {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "PATIENT":
      return { patientId: actor.userId };
    case "DENTIST":
      return { dentistId: actor.dentistId };
  }
}
