import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { PatientsTable } from "@/components/admin/patients-table";

export const metadata: Metadata = { title: "Patients" };

export default async function AdminPatientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) === "PATIENT") redirect("/dashboard");

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">Patients</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">Search and view patient records and appointment history.</p>
      </div>
      <PatientsTable />
    </div>
  );
}
