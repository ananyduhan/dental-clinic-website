import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  PlusCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CancelAppointmentButton } from "@/components/booking/cancel-appointment-button";

import {
  appointmentInterval,
  listAppointmentsFor,
  resolveActor,
} from "@/lib/appointments";
import { auth } from "@/lib/auth";
import { CANCELLATION_WINDOW_MS, MAX_PAGE_SIZE } from "@/lib/constants";
import { formatClinicDate, formatClinicTime } from "@/lib/format";

export const metadata: Metadata = { title: "My Appointments" };

export const dynamic = "force-dynamic";

const STATUS_CONFIG = {
  PENDING: { label: "Pending", variant: "pending" as const, icon: Clock },
  CONFIRMED: {
    label: "Confirmed",
    variant: "confirmed" as const,
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "cancelled" as const,
    icon: XCircle,
  },
  COMPLETED: {
    label: "Completed",
    variant: "completed" as const,
    icon: AlertCircle,
  },
};

type AppointmentView = {
  id: string;
  service: string;
  dentist: string;
  date: Date;
  startTime: string;
  status: keyof typeof STATUS_CONFIG;
  notes: string | null;
  canCancel: boolean;
};

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = await resolveActor(session);
  const { data } = await listAppointmentsFor(actor, { limit: MAX_PAGE_SIZE });

  const now = new Date();
  const appointments: AppointmentView[] = data.map((appt) => {
    const { startUtc } = appointmentInterval(appt);
    return {
      id: appt.id,
      service: appt.service.name,
      dentist: `Dr. ${appt.dentist.user.firstName} ${appt.dentist.user.lastName}`,
      date: appt.appointmentDate,
      startTime: appt.startTime,
      status: appt.status,
      notes: appt.notes,
      // Mirrors the rule the server enforces, so the button is only offered
      // when pressing it would actually work. The server decides regardless.
      canCancel:
        (appt.status === "PENDING" || appt.status === "CONFIRMED") &&
        startUtc.getTime() - now.getTime() > CANCELLATION_WINDOW_MS,
    };
  });

  const upcoming = appointments
    .filter((a) => a.status === "PENDING" || a.status === "CONFIRMED")
    .reverse();
  const past = appointments.filter(
    (a) => a.status === "COMPLETED" || a.status === "CANCELLED",
  );

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
            My Appointments
          </h1>
          <p className="text-sm text-[var(--color-text-soft)] mt-1">
            View and manage your scheduled visits.
          </p>
        </div>
        <Link href="/book">
          <Button size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Book New
          </Button>
        </Link>
      </div>

      {/* Upcoming */}
      <section aria-label="Upcoming appointments" className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-cta)] mb-4">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] text-center">
            <CalendarDays className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
            <p className="text-sm font-medium text-[var(--color-text)] mb-1">
              No upcoming appointments
            </p>
            <p className="text-xs text-[var(--color-text-soft)] mb-4">
              Book your next visit online in under 2 minutes.
            </p>
            <Link href="/book">
              <Button size="sm">Book Appointment</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((appt) => {
              const cfg = STATUS_CONFIG[appt.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={appt.id}
                  className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {appt.service}
                      </p>
                      <p className="text-xs text-[var(--color-text-soft)] mt-0.5">
                        {appt.dentist}
                      </p>
                    </div>
                    <Badge variant={cfg.variant} className="shrink-0">
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-soft)] mb-4">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatClinicDate(appt.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatClinicTime(appt.startTime)}
                    </span>
                  </div>

                  {appt.notes && (
                    <p className="text-xs text-[var(--color-text-soft)] bg-[var(--color-canvas)] rounded-md px-3 py-2 mb-4">
                      {appt.notes}
                    </p>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-[var(--color-border)]">
                    {appt.canCancel ? (
                      <CancelAppointmentButton appointmentId={appt.id} />
                    ) : (
                      <p className="text-xs text-[var(--color-text-soft)]">
                        Within 24 hours of your appointment — please call the
                        clinic to change it.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past */}
      <section aria-label="Past appointments">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-soft)] mb-4">
          Past
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-[var(--color-text-soft)] py-6 text-center">
            No past appointments.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {past.map((appt) => {
              const cfg = STATUS_CONFIG[appt.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={appt.id}
                  className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 opacity-75"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {appt.service}
                      </p>
                      <p className="text-xs text-[var(--color-text-soft)] mt-0.5">
                        {appt.dentist}
                      </p>
                    </div>
                    <Badge variant={cfg.variant} className="shrink-0">
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-soft)]">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatClinicDate(appt.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatClinicTime(appt.startTime)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
