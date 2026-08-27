"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  X,
  CalendarOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  blockDateAction,
  setAvailabilityAction,
  unblockDateAction,
} from "@/lib/actions/admin/availability";
import {
  createDentistAction,
  deactivateDentistAction,
  updateDentistAction,
} from "@/lib/actions/admin/dentists";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
type Day = (typeof DAYS)[number];

/** What a newly enabled day gets until the admin edits it. */
const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

export type AvailabilityRow = {
  dayOfWeek: Day;
  startTime: string;
  endTime: string;
};

export type BlockedDateRow = {
  id: string;
  dateKey: string;
  label: string;
  reason: string | null;
};

export type DentistRow = {
  id: string;
  name: string;
  specialisation: string;
  bio: string;
  isActive: boolean;
  availability: AvailabilityRow[];
  blockedDates: BlockedDateRow[];
};

type NewDentistDraft = {
  firstName: string;
  lastName: string;
  email: string;
  specialisation: string;
};

const EMPTY_DENTIST: NewDentistDraft = {
  firstName: "",
  lastName: "",
  email: "",
  specialisation: "",
};

export function DentistsManager({ dentists }: { dentists: DentistRow[] }) {
  const { toast } = useToast();
  const router = useRouter();

  const [editTarget, setEditTarget] = React.useState<DentistRow | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newDentist, setNewDentist] =
    React.useState<NewDentistDraft>(EMPTY_DENTIST);
  const [blockDateTarget, setBlockDateTarget] =
    React.useState<DentistRow | null>(null);
  const [newBlockDate, setNewBlockDate] = React.useState("");
  const [blockReason, setBlockReason] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  /**
   * Local draft of each dentist's roster.
   *
   * Rosters are edited as a whole week and saved explicitly — the server
   * replaces the set in one transaction, so sending a request per day toggle
   * would be both chatty and briefly incoherent.
   */
  const [rosters, setRosters] = React.useState<
    Record<string, AvailabilityRow[]>
  >(() => Object.fromEntries(dentists.map((d) => [d.id, d.availability])));

  // Re-sync when the server sends new data (after a save, or another admin's edit).
  React.useEffect(() => {
    setRosters(Object.fromEntries(dentists.map((d) => [d.id, d.availability])));
  }, [dentists]);

  function run(
    action: () => Promise<{ ok: boolean; error?: { message: string } }>,
    success: string,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        toast({
          title: "Couldn't save",
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

  function rosterFor(dentistId: string): AvailabilityRow[] {
    return rosters[dentistId] ?? [];
  }

  function isRosterDirty(dentist: DentistRow): boolean {
    const draft = [...rosterFor(dentist.id)].sort((a, b) =>
      a.dayOfWeek.localeCompare(b.dayOfWeek),
    );
    const saved = [...dentist.availability].sort((a, b) =>
      a.dayOfWeek.localeCompare(b.dayOfWeek),
    );
    return JSON.stringify(draft) !== JSON.stringify(saved);
  }

  function toggleDay(dentistId: string, day: Day) {
    setRosters((prev) => {
      const current = prev[dentistId] ?? [];
      const next = current.some((row) => row.dayOfWeek === day)
        ? current.filter((row) => row.dayOfWeek !== day)
        : [
            ...current,
            { dayOfWeek: day, startTime: DEFAULT_START, endTime: DEFAULT_END },
          ];
      return { ...prev, [dentistId]: next };
    });
  }

  function setDayTime(
    dentistId: string,
    day: Day,
    field: "startTime" | "endTime",
    value: string,
  ) {
    setRosters((prev) => ({
      ...prev,
      [dentistId]: (prev[dentistId] ?? []).map((row) =>
        row.dayOfWeek === day ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function saveRoster(dentist: DentistRow) {
    run(
      () =>
        setAvailabilityAction(dentist.id, {
          availability: rosterFor(dentist.id).map((row) => ({
            ...row,
            isActive: true,
          })),
        }),
      "Schedule saved",
    );
  }

  function toggleActive(dentist: DentistRow) {
    if (!dentist.isActive) {
      run(
        () => updateDentistAction(dentist.id, { isActive: true }),
        "Dentist reactivated",
      );
      return;
    }

    startTransition(async () => {
      const result = await deactivateDentistAction(dentist.id);

      if (!result.ok) {
        toast({
          title: "Couldn't deactivate",
          description: result.error?.message ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }

      router.refresh();
      const { upcomingAppointments } = result.data;
      toast({
        title: "Dentist deactivated",
        description:
          upcomingAppointments > 0
            ? `${upcomingAppointments} upcoming appointment${upcomingAppointments === 1 ? "" : "s"} remain booked — cancel them separately if needed.`
            : "They can no longer be booked.",
      });
    });
  }

  function handleSaveEdit() {
    if (!editTarget) return;
    run(
      () =>
        updateDentistAction(editTarget.id, {
          specialisation: editTarget.specialisation,
          bio: editTarget.bio,
        }),
      "Dentist updated",
      () => setEditTarget(null),
    );
  }

  function handleAddDentist() {
    run(
      () => createDentistAction(newDentist),
      "Dentist added",
      () => {
        setAddOpen(false);
        setNewDentist(EMPTY_DENTIST);
      },
    );
  }

  function handleBlockDate() {
    if (!blockDateTarget || !newBlockDate) return;

    startTransition(async () => {
      const result = await blockDateAction({
        dentistId: blockDateTarget.id,
        date: newBlockDate,
        reason: blockReason.trim() === "" ? undefined : blockReason.trim(),
      });

      if (!result.ok) {
        toast({
          title: "Couldn't block date",
          description: result.error?.message ?? "Something went wrong.",
          variant: "destructive",
        });
        return;
      }

      setBlockDateTarget(null);
      setNewBlockDate("");
      setBlockReason("");
      router.refresh();

      // Blocking never cancels what is already booked — say so rather than
      // letting the admin assume the day is now clear.
      const { clashingAppointments } = result.data;
      toast({
        title: "Date blocked",
        description:
          clashingAppointments > 0
            ? `${clashingAppointments} appointment${clashingAppointments === 1 ? " is" : "s are"} already booked that day and stay booked.`
            : "No new bookings will be taken that day.",
      });
    });
  }

  const isNewDentistValid =
    newDentist.firstName.trim() !== "" &&
    newDentist.lastName.trim() !== "" &&
    newDentist.email.trim() !== "" &&
    newDentist.specialisation.trim() !== "";

  return (
    <>
      <div className="flex justify-end mb-5">
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Dentist
        </Button>
      </div>

      {dentists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)]">
          <CalendarOff className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
          <p className="text-sm font-medium text-[var(--color-text)]">
            No dentists yet
          </p>
          <p className="text-xs text-[var(--color-text-soft)] mt-1">
            Add one before patients can book anything.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {dentists.map((dentist) => {
            const roster = rosterFor(dentist.id);
            const dirty = isRosterDirty(dentist);

            return (
              <Card
                key={dentist.id}
                className={dentist.isActive ? "" : "opacity-60"}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[var(--color-feature)] flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {dentist.name
                          .split(" ")
                          .slice(1)
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {dentist.name}
                        </CardTitle>
                        <p className="text-xs text-[var(--color-text-soft)]">
                          {dentist.specialisation}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={dentist.isActive ? "active" : "inactive"}>
                        {dentist.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <button
                        onClick={() => toggleActive(dentist)}
                        disabled={isPending}
                        className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] disabled:opacity-50 transition-colors"
                        aria-label={`${dentist.isActive ? "Deactivate" : "Reactivate"} ${dentist.name}`}
                      >
                        {dentist.isActive ? (
                          <ToggleRight className="h-5 w-5 text-[var(--color-cta)]" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditTarget({ ...dentist })}
                        disabled={isPending}
                        className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] disabled:opacity-50 transition-colors"
                        aria-label={`Edit ${dentist.name}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  {/* Availability */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)]">
                        Weekly Availability
                      </p>
                      {dirty && (
                        <Button
                          size="sm"
                          onClick={() => saveRoster(dentist)}
                          disabled={isPending}
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            "Save schedule"
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {DAYS.map((day) => {
                        const active = roster.some(
                          (row) => row.dayOfWeek === day,
                        );
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(dentist.id, day)}
                            disabled={isPending}
                            aria-pressed={active}
                            className={`h-8 w-9 rounded-md text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] ${
                              active
                                ? "bg-[var(--color-cta)] text-white"
                                : "bg-[var(--color-ceramic)] text-[var(--color-text-soft)] hover:bg-[var(--color-border)]"
                            }`}
                          >
                            {day.slice(0, 2)}
                          </button>
                        );
                      })}
                    </div>

                    {roster.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-soft)] italic">
                        Not rostered on any day — no slots will be offered.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {DAYS.filter((day) =>
                          roster.some((r) => r.dayOfWeek === day),
                        ).map((day) => {
                          const row = roster.find((r) => r.dayOfWeek === day)!;
                          const invalid = row.endTime <= row.startTime;
                          return (
                            <div key={day} className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[var(--color-text-soft)] w-8">
                                {day.slice(0, 3)}
                              </span>
                              <Input
                                type="time"
                                step={900}
                                value={row.startTime}
                                aria-label={`${day} start time`}
                                onChange={(e) =>
                                  setDayTime(
                                    dentist.id,
                                    day,
                                    "startTime",
                                    e.target.value,
                                  )
                                }
                                className="h-8 w-28 text-xs"
                                error={invalid}
                              />
                              <span className="text-xs text-[var(--color-text-soft)]">
                                to
                              </span>
                              <Input
                                type="time"
                                step={900}
                                value={row.endTime}
                                aria-label={`${day} finish time`}
                                onChange={(e) =>
                                  setDayTime(
                                    dentist.id,
                                    day,
                                    "endTime",
                                    e.target.value,
                                  )
                                }
                                className="h-8 w-28 text-xs"
                                error={invalid}
                              />
                              {invalid && (
                                <span className="text-xs text-[var(--color-error)]">
                                  Finish must be after start
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Blocked dates */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)]">
                        Blocked Dates
                      </p>
                      <button
                        onClick={() => {
                          setBlockDateTarget(dentist);
                          setNewBlockDate("");
                          setBlockReason("");
                        }}
                        className="text-xs font-medium text-[var(--color-cta)] hover:underline flex items-center gap-1"
                      >
                        <CalendarOff className="h-3.5 w-3.5" />
                        Block date
                      </button>
                    </div>
                    {dentist.blockedDates.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-soft)] italic">
                        No blocked dates
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {dentist.blockedDates.map((blocked) => (
                          <span
                            key={blocked.id}
                            title={blocked.reason ?? undefined}
                            className="inline-flex items-center gap-1 text-xs bg-[var(--color-error-tint)] text-[var(--color-error)] border border-[var(--color-error)]/20 rounded-full px-2.5 py-0.5"
                          >
                            {blocked.label}
                            <button
                              onClick={() =>
                                run(
                                  () => unblockDateAction(blocked.id),
                                  "Date unblocked",
                                )
                              }
                              disabled={isPending}
                              aria-label={`Remove blocked date ${blocked.label}`}
                            >
                              <X className="h-3 w-3 hover:opacity-70" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dentist dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.name}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editSpec">Specialisation</Label>
                <Input
                  id="editSpec"
                  value={editTarget.specialisation}
                  onChange={(e) =>
                    setEditTarget({
                      ...editTarget,
                      specialisation: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editBio">Bio</Label>
                <Textarea
                  id="editBio"
                  rows={3}
                  value={editTarget.bio}
                  onChange={(e) =>
                    setEditTarget({ ...editTarget, bio: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block date dialog */}
      <Dialog
        open={!!blockDateTarget}
        onOpenChange={(o) => !o && setBlockDateTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block a date for {blockDateTarget?.name}</DialogTitle>
            <DialogDescription>
              Stops new bookings on that day. Appointments already booked are
              not cancelled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="blockDate">Date</Label>
              <Input
                id="blockDate"
                type="date"
                value={newBlockDate}
                onChange={(e) => setNewBlockDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="blockReason">
                Reason{" "}
                <span className="text-[var(--color-text-soft)]">
                  (optional)
                </span>
              </Label>
              <Input
                id="blockReason"
                placeholder="Annual leave, conference…"
                maxLength={200}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setBlockDateTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBlockDate}
              disabled={!newBlockDate || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Blocking…
                </>
              ) : (
                "Block date"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dentist dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new dentist</DialogTitle>
            <DialogDescription>
              They sign in by setting their own password through the reset link
              — no password is created here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newFirst">First name</Label>
                <Input
                  id="newFirst"
                  placeholder="Jane"
                  value={newDentist.firstName}
                  onChange={(e) =>
                    setNewDentist({ ...newDentist, firstName: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newLast">Last name</Label>
                <Input
                  id="newLast"
                  placeholder="Smith"
                  value={newDentist.lastName}
                  onChange={(e) =>
                    setNewDentist({ ...newDentist, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newEmail">Email</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="jane@clinic.com"
                value={newDentist.email}
                onChange={(e) =>
                  setNewDentist({ ...newDentist, email: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newSpec">Specialisation</Label>
              <Input
                id="newSpec"
                placeholder="General Dentistry"
                value={newDentist.specialisation}
                onChange={(e) =>
                  setNewDentist({
                    ...newDentist,
                    specialisation: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAddOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDentist}
              disabled={!isNewDentistValid || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add dentist"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
