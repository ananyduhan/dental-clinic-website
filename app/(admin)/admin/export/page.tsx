import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import { ExportForm } from "@/components/admin/export-form";
import { auth } from "@/lib/auth";
import { listActiveDentists } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Export Appointments" };

export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== "ADMIN") redirect("/admin");

  const dentists = await listActiveDentists();

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Export Appointments
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Download appointment data as an Excel spreadsheet.
        </p>
      </div>
      <ExportForm
        dentists={dentists.map((d) => ({
          id: d.id,
          name: `Dr. ${d.firstName} ${d.lastName}`,
        }))}
      />
    </div>
  );
}
