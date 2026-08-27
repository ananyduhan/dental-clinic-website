import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import {
  AdminAppointmentsTable,
  type AdminAppointmentRow,
} from "@/components/admin/appointments-table";
import {
  appointmentInterval,
  listAppointmentsFor,
  resolveActor,
} from "@/lib/appointments";
import { auth } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { formatClinicDate, formatClinicTime } from "@/lib/format";

export const metadata: Metadata = { title: "Appointments" };

export const dynamic = "force-dynamic";

export default async function AdminAppointmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) === "PATIENT") redirect("/dashboard");

  const actor = await resolveActor(session);
  const { data } = await listAppointmentsFor(actor, { limit: MAX_PAGE_SIZE });

  const now = new Date();
  const rows: AdminAppointmentRow[] = data.map((appt) => {
    const { endUtc } = appointmentInterval(appt);
    return {
      id: appt.id,
      patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
      patientEmail: appt.patient.email,
      service: appt.service.name,
      dentistId: appt.dentistId,
      dentistName: `Dr. ${appt.dentist.user.firstName} ${appt.dentist.user.lastName}`,
      // Formatted here so the client never re-derives clinic-local values.
      dateLabel: formatClinicDate(appt.appointmentDate, "short"),
      timeLabel: formatClinicTime(appt.startTime),
      status: appt.status,
      adminNotes: appt.adminNotes ?? "",
      hasFinished: endUtc <= now,
    };
  });

  // Only the dentists actually present in the results — a filter listing people
  // with nothing to show is noise, and a DENTIST only ever sees themselves.
  const dentists = Array.from(
    new Map(
      rows.map((row) => [
        row.dentistId,
        { id: row.dentistId, name: row.dentistName },
      ]),
    ),
  ).map(([, dentist]) => dentist);

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Appointments
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Filter, review, and manage all appointments.
        </p>
      </div>
      <AdminAppointmentsTable
        appointments={rows}
        dentists={dentists}
        isAdmin={(session.user.role as Role) === "ADMIN"}
      />
    </div>
  );
}
