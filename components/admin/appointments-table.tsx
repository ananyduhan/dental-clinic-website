"use client";

import * as React from "react";
import { Search, Filter, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const MOCK_APPOINTMENTS = [
  { id: "a1", patient: "Emma Johnson",   email: "emma@ex.com",   service: "Check-up & Clean",   dentist: "Dr. Chen",   date: "2026-05-10", time: "09:00", status: "CONFIRMED", adminNotes: "" },
  { id: "a2", patient: "Liam Smith",     email: "liam@ex.com",   service: "Teeth Whitening",    dentist: "Dr. Walker", date: "2026-05-10", time: "10:00", status: "CONFIRMED", adminNotes: "" },
  { id: "a3", patient: "Olivia Brown",   email: "olivia@ex.com", service: "Dental Filling",     dentist: "Dr. Chen",   date: "2026-05-10", time: "11:00", status: "PENDING",   adminNotes: "" },
  { id: "a4", patient: "Noah Williams",  email: "noah@ex.com",   service: "Ortho Consult",      dentist: "Dr. Patel",  date: "2026-05-11", time: "09:30", status: "PENDING",   adminNotes: "" },
  { id: "a5", patient: "Ava Jones",      email: "ava@ex.com",    service: "Root Canal",         dentist: "Dr. Chen",   date: "2026-05-12", time: "14:00", status: "CONFIRMED", adminNotes: "Patient anxious" },
  { id: "a6", patient: "James Wilson",   email: "james@ex.com",  service: "Emergency Care",     dentist: "Dr. Walker", date: "2026-05-08", time: "16:00", status: "COMPLETED", adminNotes: "" },
  { id: "a7", patient: "Sophia Garcia",  email: "soph@ex.com",   service: "Check-up & Clean",   dentist: "Dr. Patel",  date: "2026-05-07", time: "10:30", status: "CANCELLED", adminNotes: "Patient no-show" },
];

const STATUS_VARIANTS: Record<string, "pending" | "confirmed" | "cancelled" | "completed"> = {
  PENDING:   "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

const STATUSES = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
const DENTISTS = ["ALL", "Dr. Chen", "Dr. Walker", "Dr. Patel"];

export function AdminAppointmentsTable({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const [search,       setSearch]       = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [dentistFilter, setDentistFilter] = React.useState("ALL");
  const [expanded,     setExpanded]     = React.useState<string | null>(null);
  const [editNotes,    setEditNotes]    = React.useState<{ id: string; notes: string } | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<string | null>(null);
  const [isPending,    startTransition] = React.useTransition();
  const [rows, setRows]                = React.useState(MOCK_APPOINTMENTS);

  const filtered = rows.filter((r) => {
    const matchSearch  = r.patient.toLowerCase().includes(search.toLowerCase()) ||
                         r.service.toLowerCase().includes(search.toLowerCase());
    const matchStatus  = statusFilter  === "ALL" || r.status  === statusFilter;
    const matchDentist = dentistFilter === "ALL" || r.dentist === dentistFilter;
    return matchSearch && matchStatus && matchDentist;
  });

  function handleStatusChange(id: string, status: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    toast({ title: "Status updated", description: `Appointment set to ${status.toLowerCase()}.` });
  }

  function handleSaveNotes() {
    if (!editNotes) return;
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 500));
      setRows((prev) => prev.map((r) => r.id === editNotes.id ? { ...r, adminNotes: editNotes.notes } : r));
      setEditNotes(null);
      toast({ title: "Notes saved" });
    });
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 600));
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: "CANCELLED" } : r));
      setCancelTarget(null);
      toast({ title: "Appointment cancelled" });
    });
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-soft)]" />
          <Input
            placeholder="Search patient or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-[var(--color-text-soft)]" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dentistFilter} onValueChange={setDentistFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Dentist" />
          </SelectTrigger>
          <SelectContent>
            {DENTISTS.map((d) => <SelectItem key={d} value={d}>{d === "ALL" ? "All dentists" : d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
            <p className="text-sm font-medium text-[var(--color-text)]">No appointments found</p>
            <p className="text-xs text-[var(--color-text-soft)] mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Appointments table">
              <thead className="bg-[var(--color-canvas)]">
                <tr>
                  {["Date/Time", "Patient", "Service", "Dentist", "Status", ""].map((h) => (
                    <th key={h} className="text-left py-3 px-4 first:pl-5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((appt) => (
                  <React.Fragment key={appt.id}>
                    <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-canvas)] transition-colors">
                      <td className="py-3.5 px-4 pl-5 whitespace-nowrap">
                        <p className="font-medium text-[var(--color-text)]">{appt.date}</p>
                        <p className="text-xs text-[var(--color-text-soft)]">{appt.time}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-[var(--color-text)]">{appt.patient}</p>
                        <p className="text-xs text-[var(--color-text-soft)]">{appt.email}</p>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--color-text-soft)]">{appt.service}</td>
                      <td className="py-3.5 px-4 text-[var(--color-text-soft)]">{appt.dentist}</td>
                      <td className="py-3.5 px-4">
                        {isAdmin ? (
                          <Select
                            value={appt.status}
                            onValueChange={(v) => handleStatusChange(appt.id, v)}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(STATUS_VARIANTS).map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s.charAt(0) + s.slice(1).toLowerCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={STATUS_VARIANTS[appt.status]}>
                            {appt.status.charAt(0) + appt.status.slice(1).toLowerCase()}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 pr-5">
                        <button
                          onClick={() => setExpanded(expanded === appt.id ? null : appt.id)}
                          className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors p-1"
                          aria-label="Toggle details"
                          aria-expanded={expanded === appt.id}
                        >
                          {expanded === appt.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {expanded === appt.id && (
                      <tr className="border-t border-[var(--color-border)] bg-[var(--color-canvas)]">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="flex flex-col sm:flex-row gap-4 items-start">
                            <div className="flex-1">
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)] mb-1">
                                Admin Notes
                              </p>
                              <p className="text-sm text-[var(--color-text)]">
                                {appt.adminNotes || <span className="text-[var(--color-text-soft)] italic">None</span>}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditNotes({ id: appt.id, notes: appt.adminNotes })}
                                >
                                  Edit notes
                                </Button>
                              )}
                              {isAdmin && appt.status !== "CANCELLED" && appt.status !== "COMPLETED" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setCancelTarget(appt.id)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit notes dialog */}
      <Dialog open={!!editNotes} onOpenChange={(o) => !o && setEditNotes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit admin notes</DialogTitle>
            <DialogDescription>These notes are internal and visible only to staff.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminNotes">Notes</Label>
            <Textarea
              id="adminNotes"
              rows={4}
              value={editNotes?.notes ?? ""}
              onChange={(e) => setEditNotes((n) => n ? { ...n, notes: e.target.value } : null)}
              placeholder="Add internal notes about this appointment…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditNotes(null)}>Cancel</Button>
            <Button onClick={handleSaveNotes} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>The patient will be notified by email. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={isPending}>Keep</Button>
            <Button variant="destructive" onClick={() => cancelTarget && handleCancel(cancelTarget)} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Cancelling…</> : "Cancel appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
