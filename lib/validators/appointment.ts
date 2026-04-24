import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

export const createAppointmentSchema = z.object({
  dentistId: z.string().uuid("Invalid dentist"),
  serviceId: z.string().uuid("Invalid service"),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:mm)"),
  notes: z.string().max(500).optional(),
});

export const updateAppointmentPatientSchema = z.object({
  status: z.enum([AppointmentStatus.CANCELLED]),
  notes: z.string().max(500).optional(),
});

export const updateAppointmentAdminSchema = z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  adminNotes: z.string().max(1000).optional(),
});

export const appointmentFiltersSchema = z.object({
  dentistId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const availabilityQuerySchema = z.object({
  dentistId: z.string().uuid("Invalid dentist"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  serviceId: z.string().uuid("Invalid service"),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentPatientInput = z.infer<typeof updateAppointmentPatientSchema>;
export type UpdateAppointmentAdminInput = z.infer<typeof updateAppointmentAdminSchema>;
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
