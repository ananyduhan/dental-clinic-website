import { z } from "zod";
import { DayOfWeek } from "@prisma/client";

export const createDentistSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional(),
  bio: z.string().max(1000).optional(),
  specialisation: z.string().min(1).max(100),
  profilePhotoUrl: z.string().url().optional(),
});

export const updateDentistSchema = z.object({
  bio: z.string().max(1000).optional(),
  specialisation: z.string().min(1).max(100).optional(),
  profilePhotoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.nativeEnum(DayOfWeek),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean().default(true),
});

export const updateAvailabilitySchema = z.object({
  availability: z.array(availabilitySlotSchema),
});

export const createBlockedDateSchema = z.object({
  dentistId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

export type CreateDentistInput = z.infer<typeof createDentistSchema>;
export type UpdateDentistInput = z.infer<typeof updateDentistSchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;
