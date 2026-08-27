import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  CreateDentistInput,
  UpdateDentistInput,
} from "@/lib/validators/dentist";

/** Dentist management. Admin only. */

export async function listDentists() {
  const dentists = await prisma.dentist.findMany({
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      availability: { orderBy: { dayOfWeek: "asc" } },
      _count: { select: { appointments: true } },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });

  return dentists.map(({ _count, ...dentist }) => ({
    ...dentist,
    appointmentCount: _count.appointments,
  }));
}

/**
 * Create a dentist and the user account behind them.
 *
 * No password is set. A dentist signs in by going through the password-reset
 * flow, which means the credential is chosen by them and never travels through
 * an admin's hands — and it verifies their mailbox on the way.
 */
export async function createDentist(input: CreateDentistInput) {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing)
    throw new ConflictError("An account with that email already exists");

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: "DENTIST",
        // Set by the reset flow when they first sign in.
        emailVerified: false,
      },
    });

    return tx.dentist.create({
      data: {
        userId: user.id,
        bio: input.bio,
        specialisation: input.specialisation,
        profilePhotoUrl: input.profilePhotoUrl,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  });
}

export async function updateDentist(
  dentistId: string,
  input: UpdateDentistInput,
) {
  const existing = await prisma.dentist.findUnique({
    where: { id: dentistId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Dentist not found");

  return prisma.dentist.update({
    where: { id: dentistId },
    data: input,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

/**
 * Deactivate a dentist, reporting what it leaves behind.
 *
 * Deactivating stops new bookings but does not cancel existing ones — the same
 * rule blocked dates follow. The count is returned so the admin can go and deal
 * with them deliberately rather than discovering them later.
 */
export async function deactivateDentist(dentistId: string) {
  const upcoming = await prisma.appointment.count({
    where: { dentistId, status: { in: ["PENDING", "CONFIRMED"] } },
  });

  const dentist = await updateDentist(dentistId, { isActive: false });
  return { dentist, upcomingAppointments: upcoming };
}
