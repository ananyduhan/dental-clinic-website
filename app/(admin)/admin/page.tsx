import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, Users, Clock, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@prisma/client";

import { listAppointmentsFor, resolveActor } from "@/lib/appointments";
import { auth } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { formatClinicTime } from "@/lib/format";
import { utcToClinicDateKey } from "@/lib/slots";
import { getDashboardStats } from "@/lib/stats";

export const metadata: Metadata = { title: "Admin Dashboard" };

export const dynamic = "force-dynamic";

const STATUS_BADGE_VARIANTS = {
  CONFIRMED: "confirmed" as const,
  PENDING: "pending" as const,
  CANCELLED: "cancelled" as const,
  COMPLETED: "completed" as const,
};

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) === "PATIENT") redirect("/dashboard");

  const actor = await resolveActor(session);
  const now = new Date();
  const todayKey = utcToClinicDateKey(now);

  // A dentist sees their own day; `listAppointmentsFor` scopes it from the
  // actor, so the same call serves both roles.
  const [stats, today] = await Promise.all([
    getDashboardStats(now),
    listAppointmentsFor(actor, {
      from: todayKey,
      to: todayKey,
      limit: MAX_PAGE_SIZE,
    }),
  ]);

  const schedule = [...today.data].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );

  const statCards = [
    {
      label: "Today's Appointments",
      value: stats.todaysAppointments,
      sub: `${schedule.filter((a) => a.status === "CONFIRMED").length} confirmed · ${schedule.filter((a) => a.status === "PENDING").length} pending`,
      icon: CalendarDays,
      color: "bg-[var(--color-green-light)] text-[var(--color-cta)]",
    },
    {
      label: "Total Patients",
      value: stats.totalPatients,
      sub: "Registered accounts",
      icon: Users,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Pending Confirmation",
      value: stats.pendingConfirmations,
      sub:
        stats.pendingConfirmations > 0 ? "Requires attention" : "All caught up",
      icon: Clock,
      color: "bg-amber-100 text-amber-600",
    },
    {
      label: "Cancellations",
      value: stats.cancellationsThisWeek,
      sub: "This week",
      icon: TrendingDown,
      color: "bg-red-50 text-red-500",
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          {new Date(`${todayKey}T00:00:00.000Z`).toLocaleDateString("en-AU", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[var(--color-feature)] tracking-tight">
                {value}
              </p>
              <p className="text-xs font-medium text-[var(--color-text)] mt-0.5">
                {label}
              </p>
              <p className="text-xs text-[var(--color-text-soft)] mt-0.5">
                {sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Schedule</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {schedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
              <p className="text-sm font-medium text-[var(--color-text)]">
                Nothing booked today
              </p>
              <p className="text-xs text-[var(--color-text-soft)] mt-1">
                The day is clear. New bookings will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                aria-label="Today's appointments"
              >
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    {["Time", "Patient", "Service", "Dentist", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)] first:pl-0"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((appt) => (
                    <tr
                      key={appt.id}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-canvas)] transition-colors"
                    >
                      <td className="py-3.5 px-2 pl-0 font-medium text-[var(--color-text)] whitespace-nowrap">
                        {formatClinicTime(appt.startTime)}
                      </td>
                      <td className="py-3.5 px-2 text-[var(--color-text)]">
                        {appt.patient.firstName} {appt.patient.lastName}
                      </td>
                      <td className="py-3.5 px-2 text-[var(--color-text-soft)]">
                        {appt.service.name}
                      </td>
                      <td className="py-3.5 px-2 text-[var(--color-text-soft)]">
                        Dr. {appt.dentist.user.lastName}
                      </td>
                      <td className="py-3.5 px-2">
                        <Badge variant={STATUS_BADGE_VARIANTS[appt.status]}>
                          {appt.status.charAt(0) +
                            appt.status.slice(1).toLowerCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
