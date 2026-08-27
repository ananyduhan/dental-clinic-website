import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import {
  DentistsManager,
  type DentistRow,
} from "@/components/admin/dentists-manager";
import { listDentists } from "@/lib/admin/dentists";
import { listBlockedDates } from "@/lib/admin/availability";
import { auth } from "@/lib/auth";
import { formatClinicDate } from "@/lib/format";
import { clinicDateKey } from "@/lib/slots";

export const metadata: Metadata = { title: "Dentists" };

export const dynamic = "force-dynamic";

export default async function AdminDentistsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== "ADMIN") redirect("/admin");

  const dentists = await listDentists();
  const blockedByDentist = await Promise.all(
    dentists.map(
      async (dentist) =>
        [dentist.id, await listBlockedDates(dentist.id)] as const,
    ),
  );
  const blocked = new Map(blockedByDentist);

  const rows: DentistRow[] = dentists.map((dentist) => ({
    id: dentist.id,
    name: `Dr. ${dentist.user.firstName} ${dentist.user.lastName}`,
    specialisation: dentist.specialisation,
    bio: dentist.bio ?? "",
    isActive: dentist.isActive,
    availability: dentist.availability
      .filter((row) => row.isActive)
      .map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
      })),
    blockedDates: (blocked.get(dentist.id) ?? []).map((entry) => ({
      id: entry.id,
      dateKey: clinicDateKey(entry.date),
      label: formatClinicDate(entry.date, "short"),
      reason: entry.reason,
    })),
  }));

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Dentists
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Manage dentist profiles, availability, and blocked dates.
        </p>
      </div>
      <DentistsManager dentists={rows} />
    </div>
  );
}
