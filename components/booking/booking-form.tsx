"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CalendarDays,
  CheckCircle2,
  Loader2,
  User2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Placeholder data ────────────────────────────────────────────────────────

const SERVICES = [
  { id: "s1", name: "General Check-up & Clean", durationMinutes: 45, description: "Comprehensive oral exam + professional clean." },
  { id: "s2", name: "Teeth Whitening",          durationMinutes: 90, description: "In-chair LED whitening — dramatic results in one visit." },
  { id: "s3", name: "Dental Filling",           durationMinutes: 60, description: "Tooth-coloured composite restoration." },
  { id: "s4", name: "Root Canal Treatment",     durationMinutes: 120, description: "Pain-relieving treatment that saves the tooth." },
  { id: "s5", name: "Orthodontic Consultation", durationMinutes: 60, description: "Full alignment assessment + Invisalign discussion." },
  { id: "s6", name: "Emergency Dental Care",    durationMinutes: 30, description: "Same-day urgent treatment." },
];

const DENTISTS = [
  { id: "d1", name: "Dr. Sarah Chen",   specialisation: "General & Preventive Dentistry", initials: "SC" },
  { id: "d2", name: "Dr. James Patel",  specialisation: "Orthodontics & Smile Design",    initials: "JP" },
  { id: "d3", name: "Dr. Emily Walker", specialisation: "Cosmetic & Restorative Dentistry", initials: "EW" },
  { id: "no-preference", name: "No preference", specialisation: "We'll assign the next available dentist", initials: "★" },
];

const MOCK_SLOTS = ["09:00", "09:45", "10:30", "11:15", "14:00", "14:45", "15:30", "16:15"];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Service", "Dentist", "Date & Time", "Confirm", "Done"];

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Booking progress" className="mb-8">
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "active" : "upcoming";
          return (
            <React.Fragment key={label}>
              <li className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-[var(--duration-normal)] shrink-0",
                    state === "done"     && "bg-[var(--color-cta)] text-white",
                    state === "active"   && "bg-[var(--color-feature)] text-white",
                    state === "upcoming" && "bg-[var(--color-ceramic)] text-[var(--color-text-soft)]"
                  )}
                  aria-current={state === "active" ? "step" : undefined}
                >
                  {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "hidden sm:block text-xs font-medium",
                    state === "active"   && "text-[var(--color-text)]",
                    state === "done"     && "text-[var(--color-cta)]",
                    state === "upcoming" && "text-[var(--color-text-soft)]"
                  )}
                >
                  {label}
                </span>
              </li>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px transition-colors duration-[var(--duration-normal)]",
                    i < current ? "bg-[var(--color-cta)]" : "bg-[var(--color-border)]"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Step 1: Service ─────────────────────────────────────────────────────────

function ServiceStep({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">Choose a service</h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">Select the treatment you&apos;d like to book.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SERVICES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "text-left p-4 rounded-[var(--radius-card)] border transition-all duration-[var(--duration-fast)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]",
              selected === s.id
                ? "border-[var(--color-cta)] bg-[var(--color-valid-tint)] shadow-[var(--shadow-card)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-cta)]/50"
            )}
            aria-pressed={selected === s.id}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">{s.name}</span>
              <Badge variant="ceramic" className="shrink-0 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {s.durationMinutes} min
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-text-soft)]">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Dentist ─────────────────────────────────────────────────────────

function DentistStep({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">Choose your dentist</h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">Select your preferred dentist or choose &lsquo;No preference&rsquo;.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DENTISTS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            className={cn(
              "text-left p-4 rounded-[var(--radius-card)] border transition-all duration-[var(--duration-fast)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]",
              selected === d.id
                ? "border-[var(--color-cta)] bg-[var(--color-valid-tint)] shadow-[var(--shadow-card)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-cta)]/50"
            )}
            aria-pressed={selected === d.id}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-feature)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {d.initials === "★" ? (
                  <User2 className="h-5 w-5 opacity-60" />
                ) : (
                  d.initials
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">{d.name}</p>
                <p className="text-xs text-[var(--color-text-soft)]">{d.specialisation}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Date & Time ─────────────────────────────────────────────────────

function DateTimeStep({
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
}: {
  selectedDate: Date | undefined;
  selectedTime: string | null;
  onDateSelect: (d: Date | undefined) => void;
  onTimeSelect: (t: string) => void;
}) {
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [slots, setSlots] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!selectedDate) { setSlots([]); return; }
    setLoadingSlots(true);
    const t = setTimeout(() => {
      setSlots(MOCK_SLOTS);
      setLoadingSlots(false);
    }, 600);
    return () => clearTimeout(t);
  }, [selectedDate]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">Pick a date & time</h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">Select an available date, then choose a time slot.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 flex justify-center">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={onDateSelect}
            disabled={{ before: new Date() }}
            fromDate={new Date()}
            classNames={{
              selected: "!bg-[var(--color-cta)] !text-white !rounded-full",
              today: "font-bold text-[var(--color-cta)]",
            }}
          />
        </div>

        {/* Time slots */}
        <div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--color-cta)]" />
            {selectedDate ? selectedDate.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }) : "Select a date first"}
          </p>

          {!selectedDate && (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)]">
              <CalendarDays className="h-8 w-8 text-[var(--color-text-soft)] mb-2" />
              <p className="text-sm text-[var(--color-text-soft)]">Choose a date to see available times</p>
            </div>
          )}

          {selectedDate && loadingSlots && (
            <div className="grid grid-cols-3 gap-2">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 rounded-[50px]" />)}
            </div>
          )}

          {selectedDate && !loadingSlots && slots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)]">
              <p className="text-sm font-medium text-[var(--color-text)] mb-1">No slots available</p>
              <p className="text-xs text-[var(--color-text-soft)]">Try another date or dentist.</p>
            </div>
          )}

          {selectedDate && !loadingSlots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onTimeSelect(slot)}
                  className={cn(
                    "h-10 rounded-[50px] text-sm font-medium border transition-all duration-[var(--duration-fast)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)] active:scale-95",
                    selectedTime === slot
                      ? "bg-[var(--color-cta)] text-white border-[var(--color-cta)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-cta)] hover:text-[var(--color-cta)]"
                  )}
                  aria-pressed={selectedTime === slot}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Confirm ─────────────────────────────────────────────────────────

function ConfirmStep({
  serviceId,
  dentistId,
  date,
  time,
  notes,
  onNotesChange,
  onSubmit,
  isPending,
}: {
  serviceId: string;
  dentistId: string;
  date: Date | undefined;
  time: string | null;
  notes: string;
  onNotesChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const service = SERVICES.find((s) => s.id === serviceId);
  const dentist = DENTISTS.find((d) => d.id === dentistId);

  const rows = [
    { label: "Service", value: service?.name ?? "—" },
    { label: "Duration", value: service ? `${service.durationMinutes} min` : "—" },
    { label: "Dentist", value: dentist?.name ?? "—" },
    { label: "Date", value: date?.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) ?? "—" },
    { label: "Time", value: time ?? "—" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">Confirm your booking</h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">Review your details before confirming.</p>

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden mb-6">
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className={`flex items-center justify-between px-5 py-3.5 ${i < rows.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}
          >
            <span className="text-sm text-[var(--color-text-soft)]">{label}</span>
            <span className="text-sm font-medium text-[var(--color-text)]">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 mb-6">
        <Label htmlFor="notes">Notes for your dentist <span className="text-[var(--color-text-soft)]">(optional)</span></Label>
        <Textarea
          id="notes"
          placeholder="Any concerns, allergies, or relevant medical history…"
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          maxLength={500}
        />
        <p className="text-xs text-[var(--color-text-soft)] text-right">{notes.length}/500</p>
      </div>

      <Button onClick={onSubmit} disabled={isPending} className="w-full" size="lg">
        {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Booking…</> : "Confirm Booking"}
      </Button>
    </div>
  );
}

// ─── Step 5: Success ─────────────────────────────────────────────────────────

function SuccessStep({
  serviceId,
  dentistId,
  date,
  time,
}: {
  serviceId: string;
  dentistId: string;
  date: Date | undefined;
  time: string | null;
}) {
  const service = SERVICES.find((s) => s.id === serviceId);
  const dentist = DENTISTS.find((d) => d.id === dentistId);
  const router = useRouter();

  return (
    <div className="text-center animate-fade-in">
      <div className="h-20 w-20 rounded-full bg-[var(--color-valid-tint)] flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="h-10 w-10 text-[var(--color-cta)]" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight mb-2">
        You&apos;re all booked!
      </h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-8">
        A confirmation has been sent to your email. We&apos;ll also send a reminder 24 hours before.
      </p>

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 text-left mb-8 max-w-sm mx-auto">
        {[
          { label: "Service", value: service?.name ?? "—" },
          { label: "Dentist", value: dentist?.name ?? "—" },
          { label: "Date", value: date?.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }) ?? "—" },
          { label: "Time", value: time ?? "—" },
        ].map(({ label, value }, i, arr) => (
          <div key={label} className={`flex justify-between py-2.5 ${i < arr.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}>
            <span className="text-sm text-[var(--color-text-soft)]">{label}</span>
            <span className="text-sm font-medium text-[var(--color-text)]">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={() => router.push("/appointments")}>View My Appointments</Button>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
      </div>
    </div>
  );
}

// ─── Main Booking Form ────────────────────────────────────────────────────────

export function BookingForm() {
  const [step, setStep] = React.useState(0);
  const [serviceId, setServiceId]   = React.useState<string | null>(null);
  const [dentistId, setDentistId]   = React.useState<string | null>(null);
  const [date, setDate]             = React.useState<Date | undefined>();
  const [time, setTime]             = React.useState<string | null>(null);
  const [notes, setNotes]           = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function canProceed() {
    if (step === 0) return !!serviceId;
    if (step === 1) return !!dentistId;
    if (step === 2) return !!date && !!time;
    return true;
  }

  function handleNext() {
    if (!canProceed()) return;
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleSubmit() {
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 1000));
      setStep(4);
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator current={step} />

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-6 sm:p-8">
        {step === 0 && <ServiceStep selected={serviceId} onSelect={setServiceId} />}
        {step === 1 && <DentistStep selected={dentistId} onSelect={setDentistId} />}
        {step === 2 && (
          <DateTimeStep
            selectedDate={date}
            selectedTime={time}
            onDateSelect={(d) => { setDate(d); setTime(null); }}
            onTimeSelect={setTime}
          />
        )}
        {step === 3 && (
          <ConfirmStep
            serviceId={serviceId!}
            dentistId={dentistId!}
            date={date}
            time={time}
            notes={notes}
            onNotesChange={setNotes}
            onSubmit={handleSubmit}
            isPending={isPending}
          />
        )}
        {step === 4 && (
          <SuccessStep serviceId={serviceId!} dentistId={dentistId!} date={date} time={time} />
        )}

        {/* Navigation buttons */}
        {step < 4 && step < 3 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-border)]">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {step === 2 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-border)]">
            <Button variant="ghost" onClick={handleBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
              Review Booking
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
