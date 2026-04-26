"use client";

import * as React from "react";
import { Plus, Edit2, ToggleLeft, ToggleRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const INITIAL_SERVICES = [
  { id: "s1", name: "General Check-up & Clean",   durationMinutes: 45,  description: "Comprehensive oral examination + professional scale and clean.", isActive: true },
  { id: "s2", name: "Teeth Whitening",            durationMinutes: 90,  description: "In-chair LED whitening — dramatic results in a single visit.", isActive: true },
  { id: "s3", name: "Dental Filling",             durationMinutes: 60,  description: "Tooth-coloured composite restoration.", isActive: true },
  { id: "s4", name: "Root Canal Treatment",       durationMinutes: 120, description: "Pain-relieving treatment that saves the infected tooth.", isActive: true },
  { id: "s5", name: "Orthodontic Consultation",   durationMinutes: 60,  description: "Full alignment assessment and Invisalign discussion.", isActive: true },
  { id: "s6", name: "Emergency Dental Care",      durationMinutes: 30,  description: "Same-day urgent appointment for toothache, trauma, or broken teeth.", isActive: true },
  { id: "s7", name: "Porcelain Veneer Consult",  durationMinutes: 45,  description: "Assessment for porcelain veneers and smile design.", isActive: false },
];

type Service = (typeof INITIAL_SERVICES)[number];
type ServiceDraft = { name: string; durationMinutes: number; description: string; isActive: boolean };

export function ServicesManager() {
  const { toast } = useToast();
  const [services, setServices] = React.useState(INITIAL_SERVICES);
  const [editTarget, setEditTarget] = React.useState<Service | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ServiceDraft>({ name: "", durationMinutes: 45, description: "", isActive: true });

  function toggleActive(id: string) {
    setServices((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !s.isActive } : s));
    toast({ title: "Service status updated" });
  }

  function handleSaveEdit() {
    if (!editTarget) return;
    setServices((prev) =>
      prev.map((s) => s.id === editTarget.id ? { ...editTarget } : s)
    );
    setEditTarget(null);
    toast({ title: "Service updated" });
  }

  function handleAddService() {
    const newService: Service = { ...draft, id: `s${Date.now()}` };
    setServices((prev) => [...prev, newService]);
    setAddOpen(false);
    setDraft({ name: "", durationMinutes: 45, description: "", isActive: true });
    toast({ title: "Service added" });
  }

  return (
    <>
      <div className="flex justify-end mb-5">
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {services.map((service) => (
          <Card key={service.id} className={service.isActive ? "" : "opacity-60"}>
            <CardContent className="p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{service.name}</p>
                  <Badge variant={service.isActive ? "active" : "inactive"} className="shrink-0">
                    {service.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="h-3.5 w-3.5 text-[var(--color-text-soft)]" />
                  <span className="text-xs text-[var(--color-text-soft)]">{service.durationMinutes} minutes</span>
                </div>
                <p className="text-xs text-[var(--color-text-soft)] leading-relaxed">{service.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditTarget({ ...service })}
                  className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors p-1"
                  aria-label={`Edit ${service.name}`}
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleActive(service.id)}
                  className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] transition-colors p-1"
                  aria-label={`Toggle ${service.name} active`}
                >
                  {service.isActive
                    ? <ToggleRight className="h-5 w-5 text-[var(--color-cta)]" />
                    : <ToggleLeft className="h-5 w-5" />}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit service</DialogTitle></DialogHeader>
          {editTarget && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editName">Name</Label>
                <Input id="editName" value={editTarget.name} onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editDuration">Duration (minutes)</Label>
                <Input id="editDuration" type="number" min={15} max={480} step={15} value={editTarget.durationMinutes}
                  onChange={(e) => setEditTarget({ ...editTarget, durationMinutes: parseInt(e.target.value) || 45 })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editDesc">Description</Label>
                <Textarea id="editDesc" rows={3} value={editTarget.description} onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add new service</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addName">Name</Label>
              <Input id="addName" placeholder="e.g. Dental Implant Consultation" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addDuration">Duration (minutes)</Label>
              <Input id="addDuration" type="number" min={15} max={480} step={15} value={draft.durationMinutes}
                onChange={(e) => setDraft({ ...draft, durationMinutes: parseInt(e.target.value) || 45 })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addDesc">Description</Label>
              <Textarea id="addDesc" rows={3} placeholder="Describe this service…" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddService} disabled={!draft.name}>Add service</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
