"use client";

import * as React from "react";
import { Plus, Edit2, ToggleLeft, ToggleRight, X, CalendarOff } from "lucide-react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const INITIAL_DENTISTS = [
  { id: "d1", name: "Dr. Sarah Chen",   specialisation: "General & Preventive Dentistry", isActive: true,  bio: "12 years experience.", availability: ["MON", "TUE", "WED", "THU", "FRI"] as string[], blockedDates: [] as string[] },
  { id: "d2", name: "Dr. James Patel",  specialisation: "Orthodontics & Smile Design",    isActive: true,  bio: "Invisalign specialist.", availability: ["MON", "WED", "FRI"] as string[], blockedDates: ["2026-06-15"] as string[] },
  { id: "d3", name: "Dr. Emily Walker", specialisation: "Cosmetic & Restorative",         isActive: false, bio: "On parental leave.", availability: ["TUE", "THU"] as string[], blockedDates: [] as string[] },
];

type Dentist = (typeof INITIAL_DENTISTS)[number];

export function DentistsManager() {
  const { toast } = useToast();
  const [dentists, setDentists] = React.useState(INITIAL_DENTISTS);
  const [editTarget, setEditTarget] = React.useState<Dentist | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [blockDateTarget, setBlockDateTarget] = React.useState<Dentist | null>(null);
  const [newBlockDate, setNewBlockDate] = React.useState("");

  function toggleActive(id: string) {
    setDentists((prev) =>
      prev.map((d) => d.id === id ? { ...d, isActive: !d.isActive } : d)
    );
    toast({ title: "Status updated" });
  }

  function toggleDay(dentistId: string, day: string) {
    setDentists((prev) =>
      prev.map((d) => {
        if (d.id !== dentistId) return d;
        const avail = d.availability.includes(day)
          ? d.availability.filter((x) => x !== day)
          : [...d.availability, day];
        return { ...d, availability: avail };
      })
    );
  }

  function addBlockedDate() {
    if (!blockDateTarget || !newBlockDate) return;
    setDentists((prev) =>
      prev.map((d) =>
        d.id === blockDateTarget.id
          ? { ...d, blockedDates: [...d.blockedDates, newBlockDate] }
          : d
      )
    );
    setNewBlockDate("");
    toast({ title: "Date blocked", description: newBlockDate });
  }

  function removeBlockedDate(dentistId: string, date: string) {
    setDentists((prev) =>
      prev.map((d) =>
        d.id === dentistId
          ? { ...d, blockedDates: d.blockedDates.filter((x) => x !== date) }
          : d
      )
    );
    toast({ title: "Date unblocked" });
  }

  return (
    <>
      <div className="flex justify-end mb-5">
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Dentist
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {dentists.map((dentist) => (
          <Card key={dentist.id} className={dentist.isActive ? "" : "opacity-60"}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--color-feature)] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {dentist.name.split(" ").slice(1).map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <CardTitle className="text-base">{dentist.name}</CardTitle>
                    <p className="text-xs text-[var(--color-text-soft)]">{dentist.specialisation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={dentist.isActive ? "active" : "inactive"}>
                    {dentist.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <button
                    onClick={() => toggleActive(dentist.id)}
                    className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors"
                    aria-label={`Toggle ${dentist.name} active status`}
                  >
                    {dentist.isActive ? <ToggleRight className="h-5 w-5 text-[var(--color-cta)]" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setEditTarget(dentist)}
                    className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors"
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
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)] mb-2">Weekly Availability</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(dentist.id, day)}
                      className={`h-8 w-9 rounded-md text-xs font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] ${
                        dentist.availability.includes(day)
                          ? "bg-[var(--color-cta)] text-white"
                          : "bg-[var(--color-ceramic)] text-[var(--color-text-soft)] hover:bg-[var(--color-border)]"
                      }`}
                    >
                      {day.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blocked dates */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-soft)]">Blocked Dates</p>
                  <button
                    onClick={() => { setBlockDateTarget(dentist); setNewBlockDate(""); }}
                    className="text-xs font-medium text-[var(--color-cta)] hover:underline flex items-center gap-1"
                  >
                    <CalendarOff className="h-3.5 w-3.5" />
                    Block date
                  </button>
                </div>
                {dentist.blockedDates.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-soft)] italic">No blocked dates</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {dentist.blockedDates.map((date) => (
                      <span key={date} className="inline-flex items-center gap-1 text-xs bg-[var(--color-error-tint)] text-[var(--color-error)] border border-[var(--color-error)]/20 rounded-full px-2.5 py-0.5">
                        {date}
                        <button onClick={() => removeBlockedDate(dentist.id, date)} aria-label={`Remove blocked date ${date}`}>
                          <X className="h-3 w-3 hover:opacity-70" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dentist dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editTarget?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editSpec">Specialisation</Label>
              <Input id="editSpec" defaultValue={editTarget?.specialisation} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editBio">Bio</Label>
              <Textarea id="editBio" rows={3} defaultValue={editTarget?.bio} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={() => { setEditTarget(null); toast({ title: "Dentist updated" }); }}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block date dialog */}
      <Dialog open={!!blockDateTarget} onOpenChange={(o) => !o && setBlockDateTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Block a date for {blockDateTarget?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="blockDate">Date</Label>
            <Input id="blockDate" type="date" value={newBlockDate} onChange={(e) => setNewBlockDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockDateTarget(null)}>Cancel</Button>
            <Button onClick={() => { addBlockedDate(); setBlockDateTarget(null); }} disabled={!newBlockDate}>Block date</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dentist dialog (simplified) */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add new dentist</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newFirst">First name</Label>
                <Input id="newFirst" placeholder="Jane" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newLast">Last name</Label>
                <Input id="newLast" placeholder="Smith" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newEmail">Email</Label>
              <Input id="newEmail" type="email" placeholder="jane@clinic.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newSpec">Specialisation</Label>
              <Input id="newSpec" placeholder="General Dentistry" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => { setAddOpen(false); toast({ title: "Dentist added", description: "They'll receive a welcome email." }); }}>
              Add dentist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
