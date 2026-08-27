import { AppointmentStatus, DayOfWeek } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Fixtures for the integration suites.
 *
 * Everything created here is prefixed and torn down afterwards, so a run leaves
 * the seeded database exactly as it found it. Nothing touches seed rows.
 */

const PREFIX = "itest";

/** A Monday far enough out that no seeded appointment lands on it. */
export const TEST_DATE = "2027-03-01";
/**
 * A Sunday — the one weekday no seeded dentist works.
 *
 * `getAvailableSlotsAcrossDentists` unions every active dentist in the
 * database, seeded ones included, so the "no preference" tests would otherwise
 * be at the mercy of the seed. On a Sunday only these fixtures are rostered.
 */
export const TEST_SUNDAY = "2027-03-07";
/** Well before TEST_DATE, so nothing is filtered as being in the past. */
export const TEST_NOW = new Date("2027-01-04T00:00:00.000Z");
export const TZ = "Australia/Sydney";

export type Scenario = {
  patientId: string;
  secondPatientId: string;
  dentistId: string;
  secondDentistId: string;
  serviceId: string;
  userIds: string[];
};

export async function createScenario(label: string): Promise<Scenario> {
  const tag = `${PREFIX}-${label}-${Date.now()}`;

  const service = await prisma.service.create({
    data: {
      name: `${tag} checkup`,
      durationMinutes: 30,
      description: "Integration test service",
      isActive: true,
    },
  });

  const patient = await createUser(tag, "patient", "PATIENT");
  const secondPatient = await createUser(tag, "patient2", "PATIENT");

  const dentist = await createDentist(tag, "d1");
  const secondDentist = await createDentist(tag, "d2");

  return {
    patientId: patient.id,
    secondPatientId: secondPatient.id,
    dentistId: dentist.dentistId,
    secondDentistId: secondDentist.dentistId,
    serviceId: service.id,
    userIds: [
      patient.id,
      secondPatient.id,
      dentist.userId,
      secondDentist.userId,
    ],
  };
}

async function createUser(
  tag: string,
  name: string,
  role: "PATIENT" | "DENTIST",
) {
  return prisma.user.create({
    data: {
      email: `${tag}-${name}@example.invalid`,
      firstName: name,
      lastName: "Test",
      role,
      // Booking requires a verified address; these fixtures are not testing
      // the verification gate itself.
      emailVerified: true,
    },
  });
}

async function createDentist(tag: string, name: string) {
  const user = await createUser(tag, name, "DENTIST");
  const dentist = await prisma.dentist.create({
    data: {
      userId: user.id,
      specialisation: "Integration testing",
      isActive: true,
      availability: {
        create: [
          // TEST_DATE is a Monday, TEST_SUNDAY a Sunday.
          {
            dayOfWeek: DayOfWeek.MON,
            startTime: "09:00",
            endTime: "17:00",
            isActive: true,
          },
          {
            dayOfWeek: DayOfWeek.SUN,
            startTime: "09:00",
            endTime: "17:00",
            isActive: true,
          },
        ],
      },
    },
  });
  return { userId: user.id, dentistId: dentist.id };
}

/** Delete in dependency order — appointments hold FKs to users and dentists. */
export async function destroyScenario(scenario: Scenario): Promise<void> {
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { patientId: { in: scenario.userIds } },
        { dentistId: { in: [scenario.dentistId, scenario.secondDentistId] } },
      ],
    },
  });
  await prisma.availability.deleteMany({
    where: {
      dentistId: { in: [scenario.dentistId, scenario.secondDentistId] },
    },
  });
  await prisma.blockedDate.deleteMany({
    where: {
      dentistId: { in: [scenario.dentistId, scenario.secondDentistId] },
    },
  });
  await prisma.dentist.deleteMany({
    where: { id: { in: [scenario.dentistId, scenario.secondDentistId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: scenario.userIds } } });
  await prisma.service.deleteMany({ where: { id: scenario.serviceId } });
}

export async function activeAppointmentsFor(
  dentistId: string,
  dateKey: string = TEST_DATE,
) {
  return prisma.appointment.findMany({
    where: {
      dentistId,
      appointmentDate: new Date(`${dateKey}T00:00:00.000Z`),
      status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
    },
    orderBy: { startTime: "asc" },
  });
}

/** Integration suites skip themselves when no database is configured. */
export const hasDatabase = Boolean(process.env.DATABASE_URL);
