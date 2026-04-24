# Booking Flow

> Reference doc for the appointment booking feature. Covers the slot generation algorithm, race condition handling, state machine, and edge cases. Pair this with `docs/database.md` for schema details and `docs/api-conventions.md` for endpoint shapes.

---

## Scope

This document covers:

- The end-to-end user journey for a patient booking an appointment.
- The slot generation algorithm (pure functions in `lib/slots.ts`).
- Race condition prevention at the DB and application layer.
- The appointment state machine and who can transition it.
- Cancellation, rescheduling, and reminder rules.
- Edge cases and failure modes.

Non-goals: UI component structure (see `components/booking/`), email/WhatsApp copy (see `lib/email.ts`, `lib/whatsapp.ts`), admin-side appointment management (see `docs/admin.md`).

---

## User Journey

The booking flow is a 5-step wizard at `/book`. Each step is a server component where possible; only the calendar and slot grid are client components (they need local state for selection).

| Step | Path / State | Data fetched | Validated by |
|---|---|---|---|
| 1. Select service | `?step=service` | `GET services (active)` | `serviceSelectSchema` |
| 2. Select dentist | `?step=dentist&serviceId=...` | `GET dentists (active)` | `dentistSelectSchema` |
| 3. Select date + time | `?step=slot&...` | `getAvailableSlots(...)` | `slotSelectSchema` |
| 4. Confirm | `?step=confirm&...` | Re-validates all previous selections | `createAppointmentSchema` |
| 5. Confirmed | `?step=done&appointmentId=...` | Fetches new appointment | — |

### Preconditions

Before rendering step 1, the server action checks:

1. User is authenticated (middleware enforces this for `(patient)` group).
2. `session.user.role === 'PATIENT'`.
3. `session.user.emailVerified === true`. If not, redirect to `/verify-email` with a message.

Admins and dentists cannot use `/book` — they book on behalf of patients via `/admin/appointments/new`, which bypasses verification but still runs the same slot logic.

### "No preference" dentist selection

If the patient picks "No preference" in step 2, the server picks a dentist at confirmation time (step 4), not at step 3. Slot generation in step 3 unions availability across all active dentists and tags each slot with the dentist IDs that can fill it. At confirmation, the system picks the dentist with the fewest appointments that day (load balancing); ties broken by dentist ID for determinism.

---

## Slot Generation Algorithm

All slot logic lives in `lib/slots.ts` as pure functions. No DB calls inside the generator — the caller passes in already-fetched availability, blocked dates, and existing appointments. This is what makes it unit-testable.

### Inputs

```ts
type GenerateSlotsInput = {
  date: Date;                    // the day the patient wants (UTC midnight of that clinic-tz day)
  serviceDurationMinutes: number;
  availability: Availability[];  // weekly schedule for the dentist on that day-of-week
  blockedDates: BlockedDate[];   // dentist-specific blocks for this date
  existingAppointments: Array<{  // PENDING or CONFIRMED for this dentist on this date
    startUtc: Date;
    endUtc: Date;
  }>;
  now: Date;                     // injected, never read from `new Date()` inside the function
  timezone: string;              // 'Australia/Sydney' by default
  stepMinutes?: number;          // slot granularity, default 15
};

type Slot = {
  startUtc: Date;
  endUtc: Date;
  startLocal: string;  // 'HH:mm' in clinic tz, for display
};
```

### Algorithm

1. **Check blocked dates.** If any `blockedDates` entry matches `date`, return `[]`.
2. **Resolve day of week.** Convert `date` to the clinic timezone, get its `dayOfWeek`. Fetch the matching `availability` row. If none or `is_active = false`, return `[]`.
3. **Build the working window.** Interpret `start_time` and `end_time` from the availability row as clinic-local times on `date`, then convert to UTC. These become `windowStartUtc` and `windowEndUtc`.
4. **Enumerate candidate slots.** Starting at `windowStartUtc`, step forward by `stepMinutes` (default 15). For each candidate start `s`:
   - Compute `e = s + serviceDurationMinutes`.
   - Discard if `e > windowEndUtc` (service would run past end of day).
   - Discard if `s < now` (slot is in the past).
   - Discard if `[s, e)` overlaps any existing appointment `[a.startUtc, a.endUtc)`. Overlap test: `s < a.endUtc && e > a.startUtc`.
5. **Return remaining slots** with `startLocal` formatted via `date-fns-tz` in the clinic timezone.

### Why step 15 minutes instead of `serviceDurationMinutes`

Stepping by service duration creates ugly alignment problems: if the first appointment of the day is a 30-min checkup at 09:00 and the next patient wants a 60-min filling, a duration-step generator would offer 09:30 → 10:30 only, missing that 10:00 → 11:00 is also valid. A 15-min grid gives patients more choice and packs the calendar tighter. The `stepMinutes` is configurable per deployment.

### Timezone rules

- Everything in the DB is UTC (`timestamptz` for timestamps, `date` for the appointment date, `time` for availability start/end).
- The `appointment_date` column stores the clinic-local calendar date, not a UTC date. Conversion happens at the edges — never mix UTC dates with local dates in the same code path.
- `date-fns-tz`'s `zonedTimeToUtc` and `utcToZonedTime` are the only sanctioned conversion functions. Do not use `toLocaleString`.
- The clinic timezone is `Australia/Sydney`, defined as the constant `CLINIC_TIMEZONE` in `lib/constants.ts`. Read from env in case it ever needs to change.

### Daylight saving

DST transitions matter twice a year. Two cases to handle:

- **Spring forward (02:00 → 03:00):** slots between 02:00 and 03:00 don't exist that day. `zonedTimeToUtc` maps them to 03:00 UTC equivalent, so the generator will over-count. Add an explicit check: if the local time of the generated slot does not round-trip (`utcToZonedTime(s, tz)` formatted back is not what we started with), drop it.
- **Fall back (03:00 → 02:00):** 02:00–03:00 happens twice. We pick the second occurrence (standard time) by always passing the explicit offset to `zonedTimeToUtc`. Duplicates are filtered by a `Set` on the ISO UTC string.

These are covered in `tests/slots.dst.test.ts`.

### Output size

A 9-hour day with 15-min steps yields at most 36 slots. Rendering is a simple grid. No need for pagination.

---

## Race Condition Prevention

Two patients can hit "Confirm" on the same slot within milliseconds. We defend at three layers.

### Layer 1: Optimistic UI re-check

When the patient clicks Confirm in step 4, the server action re-runs `getAvailableSlots` and verifies the chosen slot is still in the result. If not, it throws `SlotNoLongerAvailableError` and the UI sends the patient back to step 3 with a banner: "That time was just booked by someone else. Please pick another."

This catches the common case (minutes between steps) cheaply but is not a real guarantee.

### Layer 2: Serializable transaction

Appointment creation runs inside a Prisma `$transaction` with `Isolation.Serializable`:

```ts
await prisma.$transaction(async (tx) => {
  const overlap = await tx.appointment.findFirst({
    where: {
      dentistId,
      appointmentDate: date,
      status: { in: ['PENDING', 'CONFIRMED'] },
      // overlap: existing.start < new.end AND existing.end > new.start
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true },
  });
  if (overlap) throw new ConflictError('slot_taken');

  return tx.appointment.create({ data: { ... } });
}, { isolationLevel: 'Serializable' });
```

Serializable isolation means Postgres will detect concurrent conflicting writes and fail one of them with a serialization error. We catch that error and retry once; if the retry also conflicts, surface `ConflictError` to the caller.

### Layer 3: DB-enforced uniqueness

A partial unique index in the migration prevents two active appointments from sharing a `(dentist_id, appointment_date, start_time)`:

```sql
CREATE UNIQUE INDEX appointments_active_slot_unique
ON appointments (dentist_id, appointment_date, start_time)
WHERE status IN ('PENDING', 'CONFIRMED');
```

This catches exact-start-time collisions that slip past Layer 2 (rare, but possible with replication lag on read replicas). It does **not** catch overlap-only conflicts (e.g. a 09:00–10:00 and a 09:30–10:30) — Layer 2 handles those. We rely on both.

### Why not just `SELECT ... FOR UPDATE`

Considered and rejected. Row-level locking requires us to lock something stable (a dentist's "schedule row"), which we don't have. Creating a `dentist_schedule_lock` table purely for locking adds operational overhead and doesn't gain us anything over serializable isolation for this workload.

---

## Appointment State Machine

```
           book                   admin confirms
  [none] ────────▶ PENDING ───────────────▶ CONFIRMED
                     │                          │
                     │ patient cancels          │ patient cancels (>24h)
                     │ admin cancels            │ admin cancels
                     ▼                          ▼
                 CANCELLED ◀────────────── CANCELLED
                                               │
                                               │ admin marks after visit
                                               ▼
                                          COMPLETED
```

### Transitions

| From | To | Actor | Rule |
|---|---|---|---|
| none | `PENDING` | patient (or admin) | Slot must pass all three race-condition layers. |
| `PENDING` | `CONFIRMED` | admin, dentist (own appt) | No additional checks. Triggers confirmation email. |
| `PENDING` | `CANCELLED` | patient, admin, dentist | Patient only if >24h away. |
| `CONFIRMED` | `CANCELLED` | patient, admin, dentist | Patient only if >24h away. Triggers cancellation email. |
| `CONFIRMED` | `COMPLETED` | admin, dentist (own appt) | Only allowed after `appointment_date + end_time` has passed. |
| `CANCELLED` | — | — | Terminal. |
| `COMPLETED` | — | — | Terminal. |

Transitions are enforced in `lib/appointments/transition.ts`. The function takes the current appointment, the target status, and the actor; throws `ValidationError` if the transition is illegal. Route handlers and server actions call this — they never set `status` directly on the Prisma call.

### The 24-hour rule

"More than 24 hours away" is defined as:

```ts
appointmentStartUtc.getTime() - Date.now() > 24 * 60 * 60 * 1000
```

No fuzz factor. A patient trying to cancel at 23h59m gets an error with a message pointing them at the clinic phone number. Admins can always cancel.

---

## Cancellation

- Patient: `PATCH /api/appointments/:id` with `{ action: 'cancel' }`, runs through `lib/appointments/transition.ts`.
- The appointment row keeps `status = CANCELLED` — we never hard-delete (data integrity, audit trail, no-show tracking).
- If `reminder_sent = true` already, nothing special happens — the reminder already went out. The cancellation email makes it clear.
- If a reminder is scheduled but not sent (within the 23–25h window), the reminder job will skip `CANCELLED` appointments on its next run because the WHERE clause excludes them.

---

## Rescheduling

There is no "reschedule" status. Rescheduling is modeled as **cancel + rebook** at the data level, but presented as a single flow in the UI:

1. Patient clicks Reschedule on `/appointments`.
2. UI opens the booking flow pre-filled with the same dentist and service.
3. On confirm, the server action runs both mutations in one transaction: cancel the old appointment, create the new one.
4. If the new booking fails (slot taken), the transaction rolls back and the original appointment is preserved.

The new appointment's `notes` field is preserved from the old one. The old appointment's `admin_notes` is also carried over (admins expect continuity). Linking is tracked via a nullable `rescheduled_from_id` column on `appointments` for reporting.

Rescheduling is subject to the same 24h rule as cancellation.

---

## Reminders

Covered in `docs/runbook.md` operationally. Booking-relevant rules:

- On successful booking, the appointment is eligible for a reminder. No extra row is written — the cron job queries `appointments` directly.
- The cron endpoint is `/api/cron/reminders`, hit hourly by Vercel Cron (see `vercel.json`). It verifies `Authorization: Bearer ${CRON_SECRET}`.
- Query:
  ```ts
  where: {
    status: { in: ['PENDING', 'CONFIRMED'] },
    reminderSent: false,
    // startUtc between now+23h and now+25h
    startUtc: { gte: plusHours(now, 23), lt: plusHours(now, 25) },
  }
  ```
- Per matched appointment, inside a single transaction:
  1. Send WhatsApp via Twilio. If it fails, log to Sentry and continue.
  2. Send email via Resend. If it fails, log to Sentry and continue.
  3. Set `reminder_sent = true`.
- Idempotency: the `reminder_sent = true` flip is in the same transaction as the DB read, so a second cron run within the same hour (e.g. a retry) will not double-send. If both providers fail, we still set `reminder_sent = true` — we do not retry reminders, because a late reminder is worse than no reminder. Ops gets a Sentry alert and contacts the patient manually.

---

## Validation Schemas

All in `lib/validators/booking.ts`. Highlights:

```ts
export const createAppointmentSchema = z.object({
  serviceId: z.string().uuid(),
  dentistId: z.string().uuid().nullable(), // null = 'no preference'
  date: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // 'HH:mm', clinic-local
  notes: z.string().max(1000).optional(),
});
```

Notes:

- `startTime` is the clinic-local time string the UI showed the patient. The server re-converts to UTC using the clinic tz. Never trust a client-supplied UTC timestamp — the clock skew on phones is too bad.
- `notes` is capped at 1000 chars to avoid abuse. Sanitized before storage (plain text; no HTML allowed).

---

## Edge Cases

| Case | Behavior |
|---|---|
| Dentist deactivated while patient is mid-booking | Step 4 re-checks `dentist.isActive`. If false, error + send back to step 2. |
| Service deactivated mid-booking | Same — step 4 re-checks `service.isActive`. |
| Patient's email becomes unverified (edge case, shouldn't happen) | Step 4 re-checks. If unverified, abort. |
| Two back-to-back appointments with zero gap | Allowed. The overlap test uses strict inequalities (`<`, `>`), so `09:00–09:30` and `09:30–10:00` do not overlap. |
| Service duration changes after booking | Existing appointments keep their original `start_time`/`end_time` (stored directly, not derived). Only new bookings use the new duration. |
| Patient tries to book a slot entirely in the past (clock skew / crafted request) | Server action rejects with `ValidationError('slot_in_past')`. |
| Patient books during DST spring-forward gap | Generator drops those slots (see DST rule). UI never shows them. |
| Dentist availability spans midnight (e.g. late-night shift) | Not supported in MVP. Each availability row is single-day. If needed, split across two rows and document in `docs/admin.md`. |
| Patient has a prior `PENDING` appointment at the same time | Allowed at the DB level (different patient column) but blocked at the application layer — we don't want double-books. Checked in `createAppointmentSchema` refinement. |
| Blocked date added retroactively over an existing appointment | Blocking a date does not cancel existing appointments — admin must do that explicitly. Booking new slots on that date is prevented going forward. |

---

## Observability

- Every booking attempt logs `bookingAttempted` with `{ patientId, dentistId, serviceId, date, startTime, outcome }`.
- Every conflict logs `bookingConflict` at WARN level with the same fields plus `layer` (`ui`, `tx`, `index`). Useful for tuning step size and for spotting suspicious concurrent-booking patterns.
- Slot generation has a `bookingSlotsGenerated` metric with `durationMs` — watch this for drift as the appointment table grows.
- Reminder job logs `reminderSent` with `{ appointmentId, whatsappOk, emailOk }` per appointment.

---

## Testing

Unit tests in `tests/slots/`:

- `slots.basic.test.ts` — happy paths, empty schedules, past-slot filtering.
- `slots.overlap.test.ts` — edge-to-edge bookings, nested bookings, full-day blocks.
- `slots.dst.test.ts` — spring forward, fall back, both at 2am Sydney.
- `slots.duration.test.ts` — 30 / 45 / 60 / 90 min services on the same schedule.

Integration tests in `tests/booking/`:

- `booking.create.test.ts` — full server action path with a test DB.
- `booking.race.test.ts` — two concurrent `$transaction`s racing on the same slot; asserts one wins, one gets `ConflictError`.
- `booking.transition.test.ts` — every state transition, legal and illegal.

E2E in `tests/e2e/book.spec.ts`:

- Patient books, confirms, sees it on dashboard.
- Patient tries to cancel <24h away, gets blocked.
- Patient books, admin confirms, patient sees updated status.

Run with `pnpm test` (unit + integration) and `pnpm e2e` (Playwright). Both must be green before merging a change to any `lib/slots.ts` or `lib/appointments/*.ts` file.

---

## Open Questions / Future Work

- **Buffer time between appointments.** Not implemented. If requested, add a `buffer_minutes` to `services` and subtract from the generated window.
- **Waitlist.** Listed in the spec's Phase 2. When built, the waitlist cron will consume cancellations and attempt auto-booking; keep the `transition.ts` helper as the single write path so waitlist respects the state machine.
- **Multi-service bookings** (e.g. checkup + cleaning back-to-back). MVP forces one service per appointment. Stacking is up to the patient to book twice; the slot generator handles it correctly because the second booking sees the first one as existing.
- **Dentist-initiated bookings on behalf of walk-ins.** Admin panel supports this today. Dentists currently do not have this permission — revisit after launch.
