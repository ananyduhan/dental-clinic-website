"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  cancelAppointmentAsStaff,
  completeAppointment,
  confirmAppointment,
  updateAppointmentNotes,
} from "@/lib/actions/admin/appointments";
import { MAX_NOTES_LENGTH } from "@/lib/constants";

export type AdminAppointmentRow = {
  id: string;
  patientName: string;
  patientEmail: string;
  service: string;
  dentistId: string;
  dentistName: string;
  /** Clinic-local, preformatted on the server so the client does no conversion. */
  dateLabel: string;
  timeLabel: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  adminNotes: string;
  /** Whether the visit has finished — COMPLETED is refused before it has. */
  hasFinished: boolean;
};

export type AdminDentistOption = { id: string; name: string };

const STATUS_VARIANTS: Record<
  AdminAppointmentRow["status"],
  "pending" | "confirmed" | "cancelled" | "completed"
> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

const STATUSES = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
] as const;

function label(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * The transitions the state machine will actually accept from here.
 *
 * Offering every status in the dropdown would let staff pick one the server is
 * going to reject — the menu should not describe moves that do not exist.
 * `docs/booking-flow.md` holds the authoritative table; this mirrors it.
 */
function allowedTargets(
  row: AdminAppointmentRow,
): Array<AdminAppointmentRow["status"]> {
  switch (row.status) {
    case "PENDING":
      return ["CONFIRMED", "CANCELLED"];
    case "CONFIRMED":
      return row.hasFinished ? ["COMPLETED", "CANCELLED"] : ["CANCELLED"];
    default:
      // CANCELLED and COMPLETED are terminal.
      return [];
  }
}

export function AdminAppointmentsTable({
  appointments,
  dentists,
  isAdmin,
}: {
  appointments: AdminAppointmentRow[];
  dentists: AdminDentistOption[];
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [dentistFilter, setDentistFilter] = React.useState<string>("ALL");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [editNotes, setEditNotes] = React.useState<{
    id: string;
    notes: string;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const filtered = appointments.filter((row) => {
    const needle = search.toLowerCase();
    const matchSearch =
      row.patientName.toLowerCase().includes(needle) ||
      row.patientEmail.toLowerCase().includes(needle) ||
      row.service.toLowerCase().includes(needle);
    const matchStatus = statusFilter === "ALL" || row.status === statusFilter;
    const matchDentist =
      dentistFilter === "ALL" || row.dentistId === dentistFilter;
    return matchSearch && matchStatus && matchDentist;
  });

  /** Every mutation funnels through here so failures surface consistently. */
  function run(
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        toast({
          title: "Couldn't update",
          description: result.error?.message ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }

      onDone?.();
      router.refresh();
      toast({ title: success });
    });
  }

  function handleStatusChange(row: AdminAppointmentRow, next: string) {
    if (next === row.status) return;

    if (next === "CONFIRMED") {
      run(() => confirmAppointment(row.id), "Appointment confirmed");
    } else if (next === "COMPLETED") {
      run(() => completeAppointment(row.id), "Appointment marked complete");
    } else if (next === "CANCELLED") {
      setCancelTarget(row.id);
    }
  }

  function handleSaveNotes() {
    if (!editNotes) return;
    run(
      () => updateAppointmentNotes(editNotes.id, editNotes.notes),
      "Notes saved",
      () => setEditNotes(null),
    );
  }

  function handleCancel(id: string) {
    run(
      () => cancelAppointmentAsStaff(id),
      "Appointment cancelled",
      () => setCancelTarget(null),
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-soft)]" />
          <Input
            placeholder="Search patient, email, or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search appointments"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-[var(--color-text-soft)]" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All statuses" : label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dentists.length > 1 && (
          <Select value={dentistFilter} onValueChange={setDentistFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Dentist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All dentists</SelectItem>
              {dentists.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
            <p className="text-sm font-medium text-[var(--color-text)]">
              No appointments yet
            </p>
            <p className="text-xs text-[var(--color-text-soft)] mt-1">
              Bookings will appear here as patients make them.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
            <p className="text-sm font-medium text-[var(--color-text)]">
              No appointments found
            </p>
            <p className="text-xs text-[var(--color-text-soft)] mt-1">
              Try adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Appointments table">
              <thead className="bg-[var(--color-canvas)]">
                <tr>
                  {[
                    "Date/Time",
                    "Patient",
                    "Service",
                    "Dentist",
                    "Status",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 first:pl-5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((appt) => {
                  const targets = allowedTargets(appt);
                  return (
                    <React.Fragment key={appt.id}>
                      <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-canvas)] transition-colors">
                        <td className="py-3.5 px-4 pl-5 whitespace-nowrap">
                          <p className="font-medium text-[var(--color-text)]">
                            {appt.dateLabel}
                          </p>
                          <p className="text-xs text-[var(--color-text-soft)]">
                            {appt.timeLabel}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-[var(--color-text)]">
                            {appt.patientName}
                          </p>
                          <p className="text-xs text-[var(--color-text-soft)]">
                            {appt.patientEmail}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-[var(--color-text-soft)]">
                          {appt.service}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--color-text-soft)]">
                          {appt.dentistName}
                        </td>
                        <td className="py-3.5 px-4">
                          {targets.length > 0 ? (
                            <Select
                              value={appt.status}
                              onValueChange={(v) => handleStatusChange(appt, v)}
                              disabled={isPending}
                            >
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value={appt.status}
                                  className="text-xs"
                                >
                                  {label(appt.status)}
                                </SelectItem>
                                {targets.map((s) => (
                                  <SelectItem
                                    key={s}
                                    value={s}
                                    className="text-xs"
                                  >
                                    {label(s)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={STATUS_VARIANTS[appt.status]}>
                              {label(appt.status)}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 pr-5">
                          <button
                            onClick={() =>
                              setExpanded(expanded === appt.id ? null : appt.id)
                            }
                            className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors p-1"
                            aria-label="Toggle details"
                            aria-expanded={expanded === appt.id}
                          >
                            {expanded === appt.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
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
                                  {appt.adminNotes || (
                                    <span className="text-[var(--color-text-soft)] italic">
                                      None
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setEditNotes({
                                      id: appt.id,
                                      notes: appt.adminNotes,
                                    })
                                  }
                                >
                                  Edit notes
                                </Button>
                                {targets.includes("CANCELLED") && (
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
                            {!isAdmin && (
                              <p className="text-xs text-[var(--color-text-soft)] mt-3">
                                You can confirm, complete, and cancel your own
                                appointments.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
            <DialogDescription>
              These notes are internal and visible only to staff.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adminNotes">Notes</Label>
            <Textarea
              id="adminNotes"
              rows={4}
              maxLength={MAX_NOTES_LENGTH}
              value={editNotes?.notes ?? ""}
              onChange={(e) =>
                setEditNotes((n) =>
                  n ? { ...n, notes: e.target.value } : null,
                )
              }
              placeholder="Add internal notes about this appointment…"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditNotes(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNotes} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save notes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>
              The slot becomes bookable again immediately. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCancelTarget(null)}
              disabled={isPending}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelTarget && handleCancel(cancelTarget)}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Cancel appointment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
