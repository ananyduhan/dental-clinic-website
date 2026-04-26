"use client";

import * as React from "react";
import { Search, ChevronDown, ChevronUp, User2, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const MOCK_PATIENTS = [
  { id: "p1", name: "Emma Johnson",   email: "emma@ex.com",    phone: "+61412001001", joined: "2025-03-12", totalAppointments: 4, lastVisit: "2026-05-10", verified: true },
  { id: "p2", name: "Liam Smith",     email: "liam@ex.com",    phone: "+61412001002", joined: "2025-07-22", totalAppointments: 2, lastVisit: "2026-05-10", verified: true },
  { id: "p3", name: "Olivia Brown",   email: "olivia@ex.com",  phone: "+61412001003", joined: "2026-01-05", totalAppointments: 1, lastVisit: "2026-05-10", verified: true },
  { id: "p4", name: "Noah Williams",  email: "noah@ex.com",    phone: "+61412001004", joined: "2025-11-14", totalAppointments: 3, lastVisit: "2026-05-11", verified: true },
  { id: "p5", name: "Ava Jones",      email: "ava@ex.com",     phone: "+61412001005", joined: "2026-02-28", totalAppointments: 1, lastVisit: "2026-05-12", verified: false },
  { id: "p6", name: "James Wilson",   email: "james@ex.com",   phone: "+61412001006", joined: "2024-08-19", totalAppointments: 8, lastVisit: "2026-05-08", verified: true },
  { id: "p7", name: "Sophia Garcia",  email: "sophia@ex.com",  phone: "+61412001007", joined: "2024-12-03", totalAppointments: 5, lastVisit: "2026-05-07", verified: true },
];

const PATIENT_APPOINTMENTS: Record<string, { date: string; service: string; status: string }[]> = {
  p1: [
    { date: "2026-05-10", service: "Check-up & Clean", status: "CONFIRMED" },
    { date: "2025-11-15", service: "Teeth Whitening",  status: "COMPLETED" },
    { date: "2025-05-20", service: "Dental Filling",   status: "COMPLETED" },
    { date: "2025-01-10", service: "Check-up & Clean", status: "COMPLETED" },
  ],
  p6: [
    { date: "2026-05-08", service: "Emergency Care",   status: "COMPLETED" },
    { date: "2026-01-12", service: "Root Canal",       status: "COMPLETED" },
  ],
};

const STATUS_BADGE_VARIANTS: Record<string, "pending" | "confirmed" | "cancelled" | "completed"> = {
  PENDING:   "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

export function PatientsTable() {
  const [search,   setSearch]   = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const filtered = MOCK_PATIENTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-soft)]" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <User2 className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
              <p className="text-sm font-medium text-[var(--color-text)]">No patients found</p>
              <p className="text-xs text-[var(--color-text-soft)] mt-1">Try adjusting your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Patients table">
                <thead className="bg-[var(--color-canvas)]">
                  <tr>
                    {["Patient", "Contact", "Joined", "Appointments", "Verified", ""].map((h) => (
                      <th key={h} className="text-left py-3 px-4 first:pl-5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((patient) => (
                    <React.Fragment key={patient.id}>
                      <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-canvas)] transition-colors">
                        <td className="py-3.5 px-4 pl-5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-[var(--color-green-light)] flex items-center justify-center text-[var(--color-feature)] text-xs font-bold shrink-0">
                              {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="font-medium text-[var(--color-text)]">{patient.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1 text-xs text-[var(--color-text-soft)]">
                              <Mail className="h-3 w-3" />{patient.email}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-[var(--color-text-soft)]">
                              <Phone className="h-3 w-3" />{patient.phone}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[var(--color-text-soft)]">{patient.joined}</td>
                        <td className="py-3.5 px-4 text-sm font-medium text-[var(--color-text)]">
                          {patient.totalAppointments}
                          <span className="text-xs font-normal text-[var(--color-text-soft)] ml-1">total</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={patient.verified ? "confirmed" : "pending"}>
                            {patient.verified ? "Verified" : "Unverified"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 pr-5">
                          <button
                            onClick={() => setExpanded(expanded === patient.id ? null : patient.id)}
                            className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors p-1"
                            aria-label="Toggle patient history"
                            aria-expanded={expanded === patient.id}
                          >
                            {expanded === patient.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>

                      {expanded === patient.id && (
                        <tr className="border-t border-[var(--color-border)] bg-[var(--color-canvas)]">
                          <td colSpan={6} className="px-5 py-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)] mb-3">Appointment History</p>
                            {(PATIENT_APPOINTMENTS[patient.id] ?? []).length === 0 ? (
                              <p className="text-xs text-[var(--color-text-soft)] italic">No appointment history available.</p>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {(PATIENT_APPOINTMENTS[patient.id] ?? []).map((a, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs bg-[var(--color-surface)] rounded-md px-3 py-2">
                                    <span className="text-[var(--color-text-soft)]">{a.date}</span>
                                    <span className="font-medium text-[var(--color-text)]">{a.service}</span>
                                    <Badge variant={STATUS_BADGE_VARIANTS[a.status]}>
                                      {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
