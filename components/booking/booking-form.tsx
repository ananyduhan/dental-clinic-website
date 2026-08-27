"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  AlertCircle,
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
import { bookAppointment } from "@/lib/actions/appointments";
import { MAX_NOTES_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ─── Data shapes ─────────────────────────────────────────────────────────────

export type BookingService = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
};

export type BookingDentist = {
  id: string;
  firstName: string;
  lastName: string;
  specialisation: string;
};

/**
 * Sentinel for "No preference".
 *
 * The wizard needs *some* id to track the selection, but the server takes
 * `dentistId: null` and picks the dentist at confirmation time by load. This
 * never leaves the client — `dentistIdForSubmit` maps it back to null.
 */
const NO_PREFERENCE = "no-preference";

function dentistIdForSubmit(selected: string): string | null {
  return selected === NO_PREFERENCE ? null : selected;
}

function dentistName(dentist: BookingDentist) {
  return `Dr. ${dentist.firstName} ${dentist.lastName}`;
}

function initialsFor(dentist: BookingDentist) {
  return `${dentist.firstName.charAt(0)}${dentist.lastName.charAt(0)}`.toUpperCase();
}

/**
 * The calendar date as the patient sees it, "yyyy-MM-dd".
 *
 * Read from the local date parts, not `toISOString()` — the picker hands back
 * midnight in the browser's zone, and serialising that through UTC shifts the
 * day backwards for anyone east of Greenwich, which is every patient of a
 * Sydney clinic.
 */
function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Service", "Dentist", "Date & Time", "Confirm", "Done"];

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Booking progress" className="mb-8">
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const state =
            i < current ? "done" : i === current ? "active" : "upcoming";
          return (
            <React.Fragment key={label}>
              <li className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-[var(--duration-normal)] shrink-0",
                    state === "done" && "bg-[var(--color-cta)] text-white",
                    state === "active" &&
                      "bg-[var(--color-feature)] text-white",
                    state === "upcoming" &&
                      "bg-[var(--color-ceramic)] text-[var(--color-text-soft)]",
                  )}
                  aria-current={state === "active" ? "step" : undefined}
                >
                  {state === "done" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    "hidden sm:block text-xs font-medium",
                    state === "active" && "text-[var(--color-text)]",
                    state === "done" && "text-[var(--color-cta)]",
                    state === "upcoming" && "text-[var(--color-text-soft)]",
                  )}
                >
                  {label}
                </span>
              </li>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px transition-colors duration-[var(--duration-normal)]",
                    i < current
                      ? "bg-[var(--color-cta)]"
                      : "bg-[var(--color-border)]",
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

// ─── Error banner ────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-4 py-3 mb-6"
    >
      <AlertCircle className="h-4 w-4 text-[var(--color-error)] shrink-0 mt-0.5" />
      <p className="text-sm text-[var(--color-text)]">{message}</p>
    </div>
  );
}

// ─── Step 1: Service ─────────────────────────────────────────────────────────

function ServiceStep({
  services,
  selected,
  onSelect,
}: {
  services: BookingService[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">
        Choose a service
      </h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">
        Select the treatment you&apos;d like to book.
      </p>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)]">
          <p className="text-sm font-medium text-[var(--color-text)] mb-1">
            No services available
          </p>
          <p className="text-xs text-[var(--color-text-soft)]">
            Please call the clinic to book — online booking is temporarily
            unavailable.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "text-left p-4 rounded-[var(--radius-card)] border transition-all duration-[var(--duration-fast)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]",
                selected === s.id
                  ? "border-[var(--color-cta)] bg-[var(--color-valid-tint)] shadow-[var(--shadow-card)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-cta)]/50",
              )}
              aria-pressed={selected === s.id}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  {s.name}
                </span>
                <Badge
                  variant="ceramic"
                  className="shrink-0 flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" />
                  {s.durationMinutes} min
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-text-soft)]">
                {s.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Dentist ─────────────────────────────────────────────────────────

function DentistStep({
  dentists,
  selected,
  onSelect,
}: {
  dentists: BookingDentist[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">
        Choose your dentist
      </h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">
        Select your preferred dentist or choose &lsquo;No preference&rsquo;.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dentists.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelect(d.id)}
            className={cn(
              "text-left p-4 rounded-[var(--radius-card)] border transition-all duration-[var(--duration-fast)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]",
              selected === d.id
                ? "border-[var(--color-cta)] bg-[var(--color-valid-tint)] shadow-[var(--shadow-card)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-cta)]/50",
            )}
            aria-pressed={selected === d.id}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--color-feature)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {d.id === NO_PREFERENCE ? (
                  <User2 className="h-5 w-5 opacity-60" />
                ) : (
                  initialsFor(d)
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {d.id === NO_PREFERENCE ? "No preference" : dentistName(d)}
                </p>
                <p className="text-xs text-[var(--color-text-soft)]">
                  {d.specialisation}
                </p>
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
  serviceId,
  dentistId,
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
}: {
  serviceId: string;
  dentistId: string;
  selectedDate: Date | undefined;
  selectedTime: string | null;
  onDateSelect: (d: Date | undefined) => void;
  onTimeSelect: (t: string) => void;
}) {
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [slots, setSlots] = React.useState<string[]>([]);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      setSlotsError(null);
      return;
    }

    // Aborted on change so a slow response for a previously selected date can
    // never land after — and overwrite — the one the patient is looking at.
    const controller = new AbortController();
    setLoadingSlots(true);
    setSlotsError(null);

    const params = new URLSearchParams({
      date: toDateKey(selectedDate),
      serviceId,
    });
    const resolvedDentistId = dentistIdForSubmit(dentistId);
    if (resolvedDentistId) params.set("dentistId", resolvedDentistId);

    fetch(`/api/availability?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body?.error?.message ?? "Could not load times");
        setSlots(
          (body.data as Array<{ startTime: string }>).map(
            (slot) => slot.startTime,
          ),
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setSlots([]);
        setSlotsError(
          error instanceof Error
            ? error.message
            : "Could not load available times",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });

    return () => controller.abort();
  }, [selectedDate, serviceId, dentistId]);

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">
        Pick a date & time
      </h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">
        Select an available date, then choose a time slot.
      </p>

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
            {selectedDate
              ? selectedDate.toLocaleDateString("en-AU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Select a date first"}
          </p>

          {!selectedDate && (
            <div className="flex flex-col items-center justify-center py-10 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)]">
              <CalendarDays className="h-8 w-8 text-[var(--color-text-soft)] mb-2" />
              <p className="text-sm text-[var(--color-text-soft)]">
                Choose a date to see available times
              </p>
            </div>
          )}

          {selectedDate && loadingSlots && (
            <div
              className="grid grid-cols-3 gap-2"
              aria-busy="true"
              aria-label="Loading available times"
            >
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-[50px]" />
              ))}
            </div>
          )}

          {selectedDate && !loadingSlots && slotsError && (
            <div
              role="alert"
              className="flex flex-col items-center justify-center py-10 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-error)]/40"
            >
              <AlertCircle className="h-8 w-8 text-[var(--color-error)] mb-2" />
              <p className="text-sm font-medium text-[var(--color-text)] mb-1">
                {slotsError}
              </p>
              <p className="text-xs text-[var(--color-text-soft)]">
                Please pick the date again to retry.
              </p>
            </div>
          )}

          {selectedDate &&
            !loadingSlots &&
            !slotsError &&
            slots.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)]">
                <p className="text-sm font-medium text-[var(--color-text)] mb-1">
                  No slots available
                </p>
                <p className="text-xs text-[var(--color-text-soft)]">
                  Try another date or dentist.
                </p>
              </div>
            )}

          {selectedDate && !loadingSlots && !slotsError && slots.length > 0 && (
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
                      : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-cta)] hover:text-[var(--color-cta)]",
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
  services,
  dentists,
  serviceId,
  dentistId,
  date,
  time,
  notes,
  onNotesChange,
  onSubmit,
  isPending,
}: {
  services: BookingService[];
  dentists: BookingDentist[];
  serviceId: string;
  dentistId: string;
  date: Date | undefined;
  time: string | null;
  notes: string;
  onNotesChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const service = services.find((s) => s.id === serviceId);
  const dentist = dentists.find((d) => d.id === dentistId);

  const rows = [
    { label: "Service", value: service?.name ?? "—" },
    {
      label: "Duration",
      value: service ? `${service.durationMinutes} min` : "—",
    },
    {
      label: "Dentist",
      value: !dentist
        ? "—"
        : dentist.id === NO_PREFERENCE
          ? "No preference"
          : dentistName(dentist),
    },
    {
      label: "Date",
      value:
        date?.toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }) ?? "—",
    },
    { label: "Time", value: time ?? "—" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-feature)] mb-1 tracking-tight">
        Confirm your booking
      </h2>
      <p className="text-sm text-[var(--color-text-soft)] mb-6">
        Review your details before confirming.
      </p>

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden mb-6">
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className={`flex items-center justify-between px-5 py-3.5 ${i < rows.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}
          >
            <span className="text-sm text-[var(--color-text-soft)]">
              {label}
            </span>
            <span className="text-sm font-medium text-[var(--color-text)]">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 mb-6">
        <Label htmlFor="notes">
          Notes for your dentist{" "}
          <span className="text-[var(--color-text-soft)]">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Any concerns, allergies, or relevant medical history…"
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          maxLength={MAX_NOTES_LENGTH}
        />
        <p className="text-xs text-[var(--color-text-soft)] text-right">
          {notes.length}/{MAX_NOTES_LENGTH}
        </p>
      </div>

      <Button
        onClick={onSubmit}
        disabled={isPending}
        className="w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Booking…
          </>
        ) : (
          "Confirm Booking"
        )}
      </Button>
    </div>
  );
}

// ─── Step 5: Success ─────────────────────────────────────────────────────────

function SuccessStep({
  services,
  dentists,
  serviceId,
  dentistId,
  date,
  time,
}: {
  services: BookingService[];
  dentists: BookingDentist[];
  serviceId: string;
  dentistId: string;
  date: Date | undefined;
  time: string | null;
}) {
  const service = services.find((s) => s.id === serviceId);
  const dentist = dentists.find((d) => d.id === dentistId);
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
        Your appointment is pending confirmation from the clinic. We&apos;ll
        send a reminder 24 hours before.
      </p>

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 text-left mb-8 max-w-sm mx-auto">
        {[
          { label: "Service", value: service?.name ?? "—" },
          {
            label: "Dentist",
            value: !dentist
              ? "—"
              : dentist.id === NO_PREFERENCE
                ? "Assigned by the clinic"
                : dentistName(dentist),
          },
          {
            label: "Date",
            value:
              date?.toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }) ?? "—",
          },
          { label: "Time", value: time ?? "—" },
        ].map(({ label, value }, i, arr) => (
          <div
            key={label}
            className={`flex justify-between py-2.5 ${i < arr.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}
          >
            <span className="text-sm text-[var(--color-text-soft)]">
              {label}
            </span>
            <span className="text-sm font-medium text-[var(--color-text)]">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={() => router.push("/appointments")}>
          View My Appointments
        </Button>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

// ─── Main Booking Form ────────────────────────────────────────────────────────

export function BookingForm({
  services,
  dentists,
}: {
  services: BookingService[];
  dentists: BookingDentist[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [serviceId, setServiceId] = React.useState<string | null>(null);
  const [dentistId, setDentistId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState<Date | undefined>();
  const [time, setTime] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // "No preference" is appended rather than stored, so it cannot collide with a
  // real dentist id and does not need a row in the database.
  const dentistOptions = React.useMemo<BookingDentist[]>(
    () => [
      ...dentists,
      {
        id: NO_PREFERENCE,
        firstName: "No",
        lastName: "Preference",
        specialisation: "We'll assign the next available dentist",
      },
    ],
    [dentists],
  );

  function canProceed() {
    if (step === 0) return !!serviceId;
    if (step === 1) return !!dentistId;
    if (step === 2) return !!date && !!time;
    return true;
  }

  function handleNext() {
    if (!canProceed()) return;
    setError(null);
    setStep((s) => s + 1);
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function handleSubmit() {
    if (!serviceId || !dentistId || !date || !time) return;

    startTransition(async () => {
      setError(null);

      const result = await bookAppointment({
        serviceId,
        dentistId: dentistIdForSubmit(dentistId),
        appointmentDate: toDateKey(date),
        startTime: time,
        notes: notes.trim() === "" ? undefined : notes.trim(),
      });

      if (result.ok) {
        // The dashboard and appointments list are revalidated server-side; this
        // refresh makes the new booking visible if the patient navigates back.
        router.refresh();
        setStep(4);
        return;
      }

      setError(result.error.message);

      // Someone else took the slot between steps 3 and 4. Send the patient back
      // to the grid rather than leaving them staring at a dead Confirm button.
      if (
        result.error.code === "SLOT_NO_LONGER_AVAILABLE" ||
        result.error.code === "CONFLICT"
      ) {
        setTime(null);
        setStep(2);
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator current={step} />

      <div className="bg-[var(--color-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] p-6 sm:p-8">
        {error && step < 4 && <ErrorBanner message={error} />}

        {step === 0 && (
          <ServiceStep
            services={services}
            selected={serviceId}
            onSelect={setServiceId}
          />
        )}
        {step === 1 && (
          <DentistStep
            dentists={dentistOptions}
            selected={dentistId}
            onSelect={setDentistId}
          />
        )}
        {step === 2 && (
          <DateTimeStep
            serviceId={serviceId!}
            dentistId={dentistId!}
            selectedDate={date}
            selectedTime={time}
            onDateSelect={(d) => {
              setDate(d);
              setTime(null);
            }}
            onTimeSelect={setTime}
          />
        )}
        {step === 3 && (
          <ConfirmStep
            services={services}
            dentists={dentistOptions}
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
          <SuccessStep
            services={services}
            dentists={dentistOptions}
            serviceId={serviceId!}
            dentistId={dentistId!}
            date={date}
            time={time}
          />
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
              {step === 2 ? "Review Booking" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="flex items-center justify-start mt-8 pt-6 border-t border-[var(--color-border)]">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isPending}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
