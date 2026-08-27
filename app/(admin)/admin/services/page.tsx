import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import { ServicesManager } from "@/components/admin/services-manager";
import { listServices } from "@/lib/admin/services";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Services" };

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) !== "ADMIN") redirect("/admin");

  const services = await listServices();

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Services
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Add, edit, and activate dental services.
        </p>
      </div>
      <ServicesManager services={services} />
    </div>
  );
}
