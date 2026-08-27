import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * The public catalogue: services and dentists.
 *
 * Both lists are shown to unauthenticated visitors on the landing page and to
 * patients in the booking wizard, so every read here is scoped to active rows
 * and selects only fields that are safe to publish. A dentist's `user` relation
 * carries an email and a phone number; neither is ever selected.
 */

export type PublicService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
};

export type PublicDentist = {
  id: string;
  firstName: string;
  lastName: string;
  specialisation: string;
  bio: string | null;
  profilePhotoUrl: string | null;
};

export async function listActiveServices(): Promise<PublicService[]> {
  return prisma.service.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, durationMinutes: true },
    orderBy: { name: "asc" },
  });
}

export async function listActiveDentists(): Promise<PublicDentist[]> {
  const dentists = await prisma.dentist.findMany({
    where: { isActive: true },
    select: {
      id: true,
      specialisation: true,
      bio: true,
      profilePhotoUrl: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  });

  return dentists.map(({ user, ...dentist }) => ({
    ...dentist,
    firstName: user.firstName,
    lastName: user.lastName,
  }));
}

/**
 * Fetch an active service, or fail.
 *
 * Callers need the duration to generate slots and need to know the service is
 * still offered — a service can be retired while a patient sits on step 3 of
 * the wizard.
 */
export async function getActiveService(
  serviceId: string,
): Promise<PublicService> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, isActive: true },
    select: { id: true, name: true, description: true, durationMinutes: true },
  });

  if (!service) throw new NotFoundError("Service not found");
  return service;
}
