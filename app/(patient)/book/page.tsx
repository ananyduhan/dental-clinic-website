import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";

export const metadata: Metadata = { title: "Book Appointment" };

export default function BookPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">Book an Appointment</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Complete the steps below to schedule your visit.
        </p>
      </div>
      <BookingForm />
    </div>
  );
}
