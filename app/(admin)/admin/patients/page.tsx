import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import {
  PatientsTable,
  type PatientRow,
} from "@/components/admin/patients-table";
import { auth } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { formatClinicDate, formatClinicTime } from "@/lib/format";
import { listPatients } from "@/lib/patients";

export const metadata: Metadata = { title: "Patients" };

export const dynamic = "force-dynamic";

export default async function AdminPatientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) === "PATIENT") redirect("/dashboard");

  const { data } = await listPatients({ limit: MAX_PAGE_SIZE });

  const patients: PatientRow[] = data.map((patient) => ({
    id: patient.id,
    name: `${patient.firstName} ${patient.lastName}`,
    email: patient.email,
    phone: patient.phone ?? "",
    joinedLabel: formatClinicDate(patient.createdAt, "short"),
    totalAppointments: patient.appointmentCount,
    verified: patient.emailVerified,
    history: patient.recentAppointments.map((appt) => ({
      id: appt.id,
      dateLabel: formatClinicDate(appt.appointmentDate, "short"),
      timeLabel: formatClinicTime(appt.startTime),
      service: appt.service,
      status: appt.status,
    })),
  }));

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Patients
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Search and view patient records and appointment history.
        </p>
      </div>
      <PatientsTable patients={patients} />
    </div>
  );
}
