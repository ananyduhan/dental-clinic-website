"use client";

import * as React from "react";
import { Download, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export type ExportDentistOption = { id: string; name: string };

export function ExportForm({ dentists }: { dentists: ExportDentistOption[] }) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const defaultFrom = firstOfMonth.toISOString().slice(0, 10);

  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(today);
  const [dentist, setDentist] = React.useState("all");
  const [isPending, startTransition] = React.useTransition();
  const [success, setSuccess] = React.useState(false);

  const isValid = !!from && !!to && from <= to;

  function handleExport() {
    if (!isValid) return;

    startTransition(async () => {
      const params = new URLSearchParams({ from, to });
      if (dentist !== "all") params.set("dentistId", dentist);

      // Fetched rather than navigated to, so an error comes back as JSON we can
      // show instead of replacing the page with a raw error document.
      const response = await fetch(`/api/admin/export?${params.toString()}`);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast({
          title: "Export failed",
          description:
            body?.error?.message ?? "Could not build the spreadsheet.",
          variant: "destructive",
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `appointments-${from}-to-${to}.xlsx`;
      link.click();
      // The blob holds patient data in memory until it is released.
      URL.revokeObjectURL(url);

      setSuccess(true);
      toast({
        title: "Export ready",
        description: "Your download has started.",
      });
      setTimeout(() => setSuccess(false), 5000);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[var(--color-green-light)] flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-[var(--color-cta)]" />
          </div>
          <div>
            <CardTitle>Export to Excel</CardTitle>
            <CardDescription>
              Select a date range and optional dentist filter, then download.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Date range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="from">From date</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to || today}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to">To date</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
              max={today}
            />
          </div>
        </div>

        {/* Dentist filter */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dentistFilter">Dentist (optional)</Label>
          <Select value={dentist} onValueChange={setDentist}>
            <SelectTrigger id="dentistFilter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dentists</SelectItem>
              {dentists.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Info */}
        <div className="rounded-[var(--radius-card)] bg-[var(--color-canvas)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          <p className="font-medium text-[var(--color-text)] mb-1">
            What gets exported?
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>Patient name and phone number</li>
            <li>Dentist name</li>
            <li>Service and duration</li>
            <li>Appointment date, time, and status</li>
            <li>Patient notes</li>
          </ul>
        </div>

        {/* Action */}
        <Button
          onClick={handleExport}
          disabled={isPending || !isValid}
          size="lg"
          className="gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing export…
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Downloaded!
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Excel
            </>
          )}
        </Button>

        {!isValid && from && to && from > to && (
          <p className="text-xs text-[var(--color-error)]">
            The start date must be before the end date.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
