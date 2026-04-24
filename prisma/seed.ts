import { PrismaClient, Role, DayOfWeek, AppointmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, format } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data in dependency order
  await prisma.appointment.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.dentist.deleteMany();
  await prisma.service.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Admin123!", 12);
  const patientPasswordHash = await bcrypt.hash("Patient123!", 12);

  // Admin user
  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      phone: "+61400000000",
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  // Dentist users
  const dentistUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: "dr.smith@demo.com",
        passwordHash,
        firstName: "James",
        lastName: "Smith",
        phone: "+61400000001",
        role: Role.DENTIST,
        emailVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "dr.chen@demo.com",
        passwordHash,
        firstName: "Li",
        lastName: "Chen",
        phone: "+61400000002",
        role: Role.DENTIST,
        emailVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: "dr.patel@demo.com",
        passwordHash,
        firstName: "Priya",
        lastName: "Patel",
        phone: "+61400000003",
        role: Role.DENTIST,
        emailVerified: true,
      },
    }),
  ]);

  // Dentist profiles
  const dentists = await Promise.all([
    prisma.dentist.create({
      data: {
        userId: dentistUsers[0].id,
        bio: "Dr. Smith has over 15 years of experience in general and cosmetic dentistry.",
        specialisation: "General Dentistry",
        isActive: true,
        availability: {
          create: [
            { dayOfWeek: DayOfWeek.MON, startTime: "09:00", endTime: "17:00" },
            { dayOfWeek: DayOfWeek.TUE, startTime: "09:00", endTime: "17:00" },
            { dayOfWeek: DayOfWeek.WED, startTime: "09:00", endTime: "17:00" },
            { dayOfWeek: DayOfWeek.THU, startTime: "09:00", endTime: "17:00" },
            { dayOfWeek: DayOfWeek.FRI, startTime: "09:00", endTime: "15:00" },
          ],
        },
      },
    }),
    prisma.dentist.create({
      data: {
        userId: dentistUsers[1].id,
        bio: "Dr. Chen specialises in orthodontics and offers both traditional and invisible braces.",
        specialisation: "Orthodontics",
        isActive: true,
        availability: {
          create: [
            { dayOfWeek: DayOfWeek.MON, startTime: "10:00", endTime: "18:00" },
            { dayOfWeek: DayOfWeek.WED, startTime: "10:00", endTime: "18:00" },
            { dayOfWeek: DayOfWeek.FRI, startTime: "09:00", endTime: "17:00" },
            { dayOfWeek: DayOfWeek.SAT, startTime: "09:00", endTime: "13:00" },
          ],
        },
      },
    }),
    prisma.dentist.create({
      data: {
        userId: dentistUsers[2].id,
        bio: "Dr. Patel is an expert in periodontics and dental implants with a gentle approach.",
        specialisation: "Periodontics",
        isActive: true,
        availability: {
          create: [
            { dayOfWeek: DayOfWeek.TUE, startTime: "08:00", endTime: "16:00" },
            { dayOfWeek: DayOfWeek.THU, startTime: "08:00", endTime: "16:00" },
            { dayOfWeek: DayOfWeek.FRI, startTime: "08:00", endTime: "16:00" },
          ],
        },
      },
    }),
  ]);

  // Services
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: "General Checkup",
        durationMinutes: 30,
        description: "Comprehensive oral examination including X-rays.",
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: "Teeth Cleaning",
        durationMinutes: 45,
        description: "Professional scale and clean to remove plaque and tartar.",
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: "Filling",
        durationMinutes: 60,
        description: "Composite or amalgam filling for cavities.",
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: "Root Canal",
        durationMinutes: 90,
        description: "Complete root canal treatment to save an infected tooth.",
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        name: "Teeth Whitening",
        durationMinutes: 60,
        description: "Professional in-chair whitening for a brighter smile.",
        isActive: true,
      },
    }),
  ]);

  // Test patients
  const patients = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      prisma.user.create({
        data: {
          email: `patient${i + 1}@demo.com`,
          passwordHash: patientPasswordHash,
          firstName: ["Alice", "Bob", "Carol", "David", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack"][i],
          lastName: ["Johnson", "Williams", "Brown", "Taylor", "Davis", "Miller", "Wilson", "Moore", "Anderson", "Thomas"][i],
          phone: `+6140000${String(i + 10).padStart(4, "0")}`,
          role: Role.PATIENT,
          emailVerified: true,
        },
      })
    )
  );

  // 20 sample appointments spread over next 2 weeks
  const statuses = [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
  ];

  const appointmentData = Array.from({ length: 20 }, (_, i) => {
    const daysAhead = Math.floor(i / 3) + 1;
    const date = addDays(new Date(), daysAhead);
    const dentist = dentists[i % 3];
    const service = services[i % 5];
    const hour = 9 + (i % 4) * 2;
    const startTime = `${String(hour).padStart(2, "0")}:00`;
    const endTime = `${String(hour + Math.ceil(service.durationMinutes / 60)).padStart(2, "0")}:00`;

    return {
      patientId: patients[i % 10].id,
      dentistId: dentist.id,
      serviceId: service.id,
      appointmentDate: date,
      startTime,
      endTime,
      status: statuses[i],
      notes: i % 3 === 0 ? "Patient has tooth sensitivity" : null,
    };
  });

  for (const data of appointmentData) {
    await prisma.appointment.upsert({
      where: {
        dentistId_appointmentDate_startTime: {
          dentistId: data.dentistId,
          appointmentDate: data.appointmentDate,
          startTime: data.startTime,
        },
      },
      update: {},
      create: data,
    });
  }

  console.log(`Seeded:`);
  console.log(`  1 admin (admin@demo.com / Admin123!)`);
  console.log(`  3 dentists`);
  console.log(`  5 services`);
  console.log(`  10 patients (patient1@demo.com … patient10@demo.com / Patient123!)`);
  console.log(`  20 appointments`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
