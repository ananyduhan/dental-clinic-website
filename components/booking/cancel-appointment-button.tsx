"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { cancelAppointment } from "@/lib/actions/appointments";

export function CancelAppointmentButton({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelAppointment(appointmentId);

      if (!result.ok) {
        // The 24-hour rule and the state machine both surface here. The server
        // is the authority even though the list only offers the button when it
        // expects the cancellation to be allowed.
        toast({
          title: "Couldn't cancel",
          description: result.error.message,
          variant: "destructive",
        });
        return;
      }

      setOpen(false);
      // The action revalidates the page; refresh pulls the new render in.
      router.refresh();
      toast({
        title: "Appointment cancelled",
        description: "That time is free again if you'd like to rebook.",
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
              This cannot be undone. You can rebook at any time. Cancellations
              are only allowed more than 24 hours before the appointment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Keep appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling…
                </>
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
