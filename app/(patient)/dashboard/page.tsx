import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

const MOCK_APPOINTMENTS = [
  {
    id: "1",
    service: "General Check-up & Clean",
    dentist: "Dr. Sarah Chen",
    date: "2026-05-10",
    time: "10:00 AM",
    status: "CONFIRMED" as const,
  },
  {
    id: "2",
    service: "Teeth Whitening",
    dentist: "Dr. Emily Walker",
    date: "2026-05-22",
    time: "2:30 PM",
    status: "PENDING" as const,
  },
];

const STATUS_CONFIG = {
  PENDING:   { label: "Pending",   variant: "pending"   as const, icon: Clock },
  CONFIRMED: { label: "Confirmed", variant: "confirmed" as const, icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", variant: "cancelled" as const, icon: AlertCircle },
  COMPLETED: { label: "Completed", variant: "completed" as const, icon: CheckCircle2 },
};

function AppointmentCard({
  appointment,
}: {
  appointment: (typeof MOCK_APPOINTMENTS)[number];
}) {
  const cfg = STATUS_CONFIG[appointment.status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-4 p-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-cta)]/30 transition-colors">
      <div className="h-10 w-10 rounded-full bg-[var(--color-green-light)] flex items-center justify-center shrink-0">
        <CalendarDays className="h-5 w-5 text-[var(--color-cta)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)] truncate">
              {appointment.service}
            </p>
            <p className="text-xs text-[var(--color-text-soft)] mt-0.5">
              {appointment.dentist} · {appointment.date} at {appointment.time}
            </p>
          </div>
          <Badge variant={cfg.variant} className="shrink-0">
            <Icon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function AppointmentsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-start gap-4 p-4 rounded-[var(--radius-card)] border border-[var(--color-border)]">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-20 rounded-[50px]" />
        </div>
      ))}
    </div>
  );
}

async function UpcomingAppointments() {
  await new Promise((r) => setTimeout(r, 100));
  const appointments = MOCK_APPOINTMENTS;

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-14 w-14 rounded-full bg-[var(--color-ceramic)] flex items-center justify-center mb-4">
          <CalendarDays className="h-7 w-7 text-[var(--color-text-soft)]" />
        </div>
        <p className="text-base font-semibold text-[var(--color-text)] mb-2">
          No upcoming appointments
        </p>
        <p className="text-sm text-[var(--color-text-soft)] mb-6 max-w-xs">
          You don&apos;t have any upcoming visits. Book your next appointment in seconds.
        </p>
        <Link href="/book">
          <Button size="sm">Book Appointment</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {appointments.map((appt) => (
        <AppointmentCard key={appt.id} appointment={appt} />
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstName = session.user.firstName ?? "there";

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Good morning, {firstName} 👋
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Here&apos;s what&apos;s coming up for you.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link href="/book">
          <Card className="h-full hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 transition-all duration-[var(--duration-normal)] cursor-pointer group">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="h-10 w-10 rounded-full bg-[var(--color-cta)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <PlusCircle className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Book Appointment</p>
              <p className="text-xs text-[var(--color-text-soft)]">Schedule your next visit</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/appointments">
          <Card className="h-full hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 transition-all duration-[var(--duration-normal)] cursor-pointer group">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="h-10 w-10 rounded-full bg-[var(--color-green-light)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <CalendarDays className="h-5 w-5 text-[var(--color-cta)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--color-text)]">My Appointments</p>
              <p className="text-xs text-[var(--color-text-soft)]">View & manage visits</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Upcoming appointments */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
            <Link
              href="/appointments"
              className="text-xs font-semibold text-[var(--color-cta)] hover:underline"
            >
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Suspense fallback={<AppointmentsSkeleton />}>
            <UpcomingAppointments />
          </Suspense>
        </CardContent>
      </Card>

      {/* Health reminder */}
      <div className="mt-6 rounded-[var(--radius-card)] bg-[var(--color-feature)] px-6 py-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-[var(--color-cta)]/20 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-[var(--color-green-light)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white mb-1">Dental health tip</p>
          <p className="text-xs text-[var(--color-text-invert-soft)]">
            Regular check-ups every 6 months keep tooth decay and gum disease at bay — and keep your treatment costs low in the long run.
          </p>
        </div>
      </div>
    </div>
  );
}
