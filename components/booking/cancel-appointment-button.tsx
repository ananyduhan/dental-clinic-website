"use client";

import * as React from "react";
import { Loader2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  function handleCancel() {
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 800));
      setOpen(false);
      toast({
        title: "Appointment cancelled",
        description: `Appointment ${appointmentId} has been cancelled.`,
        variant: "default",
      });
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <XCircle className="h-3.5 w-3.5" />
        Cancel appointment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>
              This cannot be undone. You can rebook at any time. Cancellations are only allowed more than 24 hours before the appointment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Keep appointment
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Cancelling…</>
              ) : (
                "Yes, cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
