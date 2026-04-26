import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { ExportForm } from "@/components/admin/export-form";

export const metadata: Metadata = { title: "Export Appointments" };

export default async function AdminExportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== "ADMIN") redirect("/admin");

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">Export Appointments</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">Download appointment data as an Excel spreadsheet.</p>
      </div>
      <ExportForm />
    </div>
  );
}
