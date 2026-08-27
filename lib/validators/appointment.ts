import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

import { MAX_NOTES_LENGTH } from "@/lib/constants";

export const createAppointmentSchema = z.object({
  /**
   * `null` is the "No preference" option the booking form has always rendered
   * (`booking-form.tsx:38`). It was previously required, which made that option
   * impossible to submit. The dentist is chosen server-side at confirmation.
   */
  dentistId: z.string().uuid("Invalid dentist").nullable(),
  serviceId: z.string().uuid("Invalid service"),
  /**
   * Clinic-local calendar date. Named for the Prisma column rather than the
   * `date` used in docs/booking-flow.md — the doc is the drifted side.
   */
  appointmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  /**
   * Clinic-local wall clock, as shown to the patient. The server re-converts to
   * UTC; a client-supplied UTC timestamp is never trusted, because phone clock
   * skew is too bad to rely on.
   */
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:mm)"),
  notes: z.string().max(MAX_NOTES_LENGTH).optional(),
});

export const updateAppointmentPatientSchema = z.object({
  status: z.enum([AppointmentStatus.CANCELLED]),
  notes: z.string().max(MAX_NOTES_LENGTH).optional(),
});

export const updateAppointmentAdminSchema = z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  adminNotes: z.string().max(MAX_NOTES_LENGTH).optional(),
});

export const appointmentFiltersSchema = z.object({
  dentistId: z.string().uuid().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const availabilityQuerySchema = z.object({
  /** Omitted or null asks for the union across every active dentist. */
  dentistId: z.string().uuid("Invalid dentist").nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  serviceId: z.string().uuid("Invalid service"),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentPatientInput = z.infer<
  typeof updateAppointmentPatientSchema
>;
export type UpdateAppointmentAdminInput = z.infer<
  typeof updateAppointmentAdminSchema
>;
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
