import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { DentistsManager } from "@/components/admin/dentists-manager";

export const metadata: Metadata = { title: "Dentists" };

export default async function AdminDentistsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== "ADMIN") redirect("/admin");

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">Dentists</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">Manage dentist profiles, availability, and blocked dates.</p>
      </div>
      <DentistsManager />
    </div>
  );
}
