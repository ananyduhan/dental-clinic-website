"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Clock,
} from "lucide-react";
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
import {
  createServiceAction,
  deactivateServiceAction,
  updateServiceAction,
} from "@/lib/actions/admin/services";

export type ServiceRow = {
  id: string;
  name: string;
  durationMinutes: number;
  description: string;
  isActive: boolean;
};

type ServiceDraft = {
  name: string;
  durationMinutes: number;
  description: string;
};

const EMPTY_DRAFT: ServiceDraft = {
  name: "",
  durationMinutes: 45,
  description: "",
};

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [editTarget, setEditTarget] = React.useState<ServiceRow | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ServiceDraft>(EMPTY_DRAFT);
  const [isPending, startTransition] = React.useTransition();

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

  function toggleActive(service: ServiceRow) {
    if (service.isActive) {
      // Retire it, and say what is still booked against it — deactivating does
      // not cancel anything, and the admin needs to know that.
      startTransition(async () => {
        const result = await deactivateServiceAction(service.id);

        if (!result.ok) {
          toast({
            title: "Couldn't retire service",
            description: result.error?.message ?? "Something went wrong.",
            variant: "destructive",
          });
          return;
        }

        router.refresh();
        const { upcomingAppointments } = result.data;
        toast({
          title: "Service retired",
          description:
            upcomingAppointments > 0
              ? `${upcomingAppointments} upcoming appointment${upcomingAppointments === 1 ? "" : "s"} still use this service — they are unaffected.`
              : "It can no longer be booked.",
        });
      });
      return;
    }

    run(
      () => updateServiceAction(service.id, { isActive: true }),
      "Service reactivated",
    );
  }

  function handleSaveEdit() {
    if (!editTarget) return;
    run(
      () =>
        updateServiceAction(editTarget.id, {
          name: editTarget.name,
          durationMinutes: editTarget.durationMinutes,
          description: editTarget.description,
        }),
      "Service updated",
      () => setEditTarget(null),
    );
  }

  function handleAddService() {
    run(
      () => createServiceAction({ ...draft, isActive: true }),
      "Service added",
      () => {
        setAddOpen(false);
        setDraft(EMPTY_DRAFT);
      },
    );
  }

  const isDraftValid =
    draft.name.trim().length > 0 && draft.description.trim().length > 0;

  return (
    <>
      <div className="flex justify-end mb-5">
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)]">
          <Clock className="h-8 w-8 text-[var(--color-text-soft)] mb-3" />
          <p className="text-sm font-medium text-[var(--color-text)]">
            No services yet
          </p>
          <p className="text-xs text-[var(--color-text-soft)] mt-1">
            Add one so patients have something to book.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className={service.isActive ? "" : "opacity-60"}
            >
              <CardContent className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                      {service.name}
                    </p>
                    <Badge
                      variant={service.isActive ? "active" : "inactive"}
                      className="shrink-0"
                    >
                      {service.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Clock className="h-3.5 w-3.5 text-[var(--color-text-soft)]" />
                    <span className="text-xs text-[var(--color-text-soft)]">
                      {service.durationMinutes} minutes
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-soft)] leading-relaxed">
                    {service.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditTarget({ ...service })}
                    disabled={isPending}
                    className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] disabled:opacity-50 transition-colors p-1"
                    aria-label={`Edit ${service.name}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(service)}
                    disabled={isPending}
                    className="text-[var(--color-text-soft)] hover:text-[var(--color-cta)] disabled:opacity-50 transition-colors p-1"
                    aria-label={`${service.isActive ? "Retire" : "Reactivate"} ${service.name}`}
                  >
                    {service.isActive ? (
                      <ToggleRight className="h-5 w-5 text-[var(--color-cta)]" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit service</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  value={editTarget.name}
                  onChange={(e) =>
                    setEditTarget({ ...editTarget, name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editDuration">Duration (minutes)</Label>
                <Input
                  id="editDuration"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={editTarget.durationMinutes}
                  onChange={(e) =>
                    setEditTarget({
                      ...editTarget,
                      durationMinutes: parseInt(e.target.value) || 45,
                    })
                  }
                />
                <p className="text-xs text-[var(--color-text-soft)]">
                  Changing this only affects new bookings. Existing appointments
                  keep their original times.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editDesc">Description</Label>
                <Textarea
                  id="editDesc"
                  rows={3}
                  value={editTarget.description}
                  onChange={(e) =>
                    setEditTarget({
                      ...editTarget,
                      description: e.target.value,
                    })
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

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new service</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addName">Name</Label>
              <Input
                id="addName"
                placeholder="e.g. Dental Implant Consultation"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addDuration">Duration (minutes)</Label>
              <Input
                id="addDuration"
                type="number"
                min={15}
                max={480}
                step={15}
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    durationMinutes: parseInt(e.target.value) || 45,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addDesc">Description</Label>
              <Textarea
                id="addDesc"
                rows={3}
                placeholder="Describe this service…"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
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
              onClick={handleAddService}
              disabled={!isDraftValid || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add service"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
