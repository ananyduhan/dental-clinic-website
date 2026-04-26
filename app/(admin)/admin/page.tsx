import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CalendarDays, Users, Clock, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@prisma/client";

export const metadata: Metadata = { title: "Admin Dashboard" };

const STAT_CARDS = [
  { label: "Today's Appointments", value: "8",  sub: "3 confirmed · 5 pending", icon: CalendarDays, color: "bg-[var(--color-green-light)] text-[var(--color-cta)]" },
  { label: "Total Patients",       value: "247", sub: "+12 this month",          icon: Users,        color: "bg-blue-100 text-blue-600" },
  { label: "Pending Confirmation", value: "5",   sub: "Requires attention",      icon: Clock,        color: "bg-amber-100 text-amber-600" },
  { label: "Cancellations",        value: "2",   sub: "This week",              icon: TrendingDown, color: "bg-red-50 text-red-500" },
];

const TODAY_APPOINTMENTS = [
  { id: "t1", time: "09:00", patient: "Emma Johnson",    service: "Check-up & Clean",  dentist: "Dr. Chen",   status: "CONFIRMED" as const },
  { id: "t2", time: "10:00", patient: "Liam Smith",      service: "Teeth Whitening",   dentist: "Dr. Walker", status: "CONFIRMED" as const },
  { id: "t3", time: "11:00", patient: "Olivia Brown",    service: "Dental Filling",    dentist: "Dr. Chen",   status: "PENDING"   as const },
  { id: "t4", time: "13:30", patient: "Noah Williams",   service: "Orthodontic Consult", dentist: "Dr. Patel", status: "CONFIRMED" as const },
  { id: "t5", time: "14:30", patient: "Ava Jones",       service: "Root Canal",        dentist: "Dr. Chen",   status: "PENDING"   as const },
  { id: "t6", time: "15:30", patient: "William Garcia",  service: "Emergency Care",    dentist: "Dr. Walker", status: "PENDING"   as const },
];

const STATUS_BADGE_VARIANTS = {
  CONFIRMED: "confirmed" as const,
  PENDING:   "pending"   as const,
  CANCELLED: "cancelled" as const,
  COMPLETED: "completed" as const,
};

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user.role as Role) === "PATIENT") redirect("/dashboard");

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[var(--color-feature)] tracking-tight">{value}</p>
              <p className="text-xs font-medium text-[var(--color-text)] mt-0.5">{label}</p>
              <p className="text-xs text-[var(--color-text-soft)] mt-0.5">{sub}</p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Today's appointments">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Time", "Patient", "Service", "Dentist", "Status"].map((h) => (
                    <th key={h} className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)] first:pl-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TODAY_APPOINTMENTS.map((appt) => (
                  <tr
                    key={appt.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-canvas)] transition-colors"
                  >
                    <td className="py-3.5 px-2 pl-0 font-medium text-[var(--color-text)] whitespace-nowrap">
                      {appt.time}
                    </td>
                    <td className="py-3.5 px-2 text-[var(--color-text)]">{appt.patient}</td>
                    <td className="py-3.5 px-2 text-[var(--color-text-soft)]">{appt.service}</td>
                    <td className="py-3.5 px-2 text-[var(--color-text-soft)]">{appt.dentist}</td>
                    <td className="py-3.5 px-2">
                      <Badge variant={STATUS_BADGE_VARIANTS[appt.status]}>
                        {appt.status.charAt(0) + appt.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
