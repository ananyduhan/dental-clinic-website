import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BookingForm } from "@/components/booking/booking-form";
import { auth } from "@/lib/auth";
import { listActiveDentists, listActiveServices } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Book Appointment" };

/**
 * Reads the session and the live catalogue, so it must render per request.
 * Server Actions in the form revalidate the patient's other pages on success.
 */
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Preconditions from docs/booking-flow.md. Staff book on behalf of patients
  // from the admin area, and an unverified address cannot hold a booking.
  if (session.user.role !== "PATIENT") redirect("/admin/appointments");
  if (!session.user.isEmailVerified) redirect("/verify-email?status=pending");

  const [services, dentists] = await Promise.all([
    listActiveServices(),
    listActiveDentists(),
  ]);

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Book an Appointment
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Complete the steps below to schedule your visit.
        </p>
      </div>
      <BookingForm services={services} dentists={dentists} />
    </div>
  );
}
