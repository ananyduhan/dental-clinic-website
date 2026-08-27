import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  CreateServiceInput,
  UpdateServiceInput,
} from "@/lib/validators/service";

/** Service management. Admin only — callers sit behind `requireRole('ADMIN')`. */

export async function listServices() {
  return prisma.service.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function createService(input: CreateServiceInput) {
  return prisma.service.create({ data: input });
}

export async function updateService(
  serviceId: string,
  input: UpdateServiceInput,
) {
  const existing = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Service not found");

  return prisma.service.update({ where: { id: serviceId }, data: input });
}

/**
 * Retire a service.
 *
 * Deactivation, never deletion: appointments reference the service and their
 * history has to stay readable. Existing bookings are left alone — the edge
 * case table is explicit that a deactivated service only affects new bookings.
 */
export async function deactivateService(serviceId: string) {
  const upcoming = await prisma.appointment.count({
    where: {
      serviceId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });

  const service = await updateService(serviceId, { isActive: false });
  return { service, upcomingAppointments: upcoming };
}

/** Guard against a name collision that would confuse the booking wizard. */
export async function assertServiceNameFree(name: string, exceptId?: string) {
  const clash = await prisma.service.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });

  if (clash) throw new ConflictError("A service with that name already exists");
}
