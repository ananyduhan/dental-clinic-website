import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminAppointmentsTable } from "@/components/admin/appointments-table";
import type { Role } from "@prisma/client";

export const metadata: Metadata = { title: "Appointments" };

export default async function AdminAppointmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) === "PATIENT") redirect("/dashboard");

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">Appointments</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">Filter, review, and manage all appointments.</p>
      </div>
      <AdminAppointmentsTable isAdmin={(session.user.role as Role) === "ADMIN"} />
    </div>
  );
}
