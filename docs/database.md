# Database

> Reference doc for the dental clinic app's data layer. Schema, conventions, indexes, and query patterns. Kept concise — see `CLAUDE.md` for project-wide rules and `docs/booking-flow.md` for the slot-generation algorithm.

---

## Overview

- **Engine:** PostgreSQL, hosted on Supabase.
- **ORM:** Prisma. All DB access goes through the singleton client in `lib/prisma.ts`. Never instantiate `PrismaClient` elsewhere.
- **Migrations:** `prisma migrate` only. `prisma db push` is dev-scratch and must never touch production.
- **Timezone:** all timestamps stored as UTC. `appointment_date` + `start_time` are interpreted in the clinic timezone (`Australia/Sydney`) and converted at the edges using `date-fns-tz`.
- **IDs:** UUID v4, generated DB-side via `gen_random_uuid()` (requires `pgcrypto`).
- **Soft delete:** we do not hard-delete patients, dentists, or appointments. Use `is_active` flags or status enums. Appointments use `status = CANCELLED`.

---

## Conventions

### Naming
- Tables: `snake_case`, plural (`users`, `appointments`, `blocked_dates`).
- Columns: `snake_case`.
- Foreign keys: `<referenced_table_singular>_id` (`patient_id`, `dentist_id`).
- Enums: `SCREAMING_SNAKE_CASE` values, PascalCase type name in Prisma.
- Timestamps: every table has `created_at`; mutable tables also have `updated_at`.
- Booleans: `is_*`, `has_*` (`is_active`, `email_verified`).

### Types
- IDs: `uuid`, primary key, default `gen_random_uuid()`.
- Strings with known bounds: `varchar(n)`. Free text: `text`.
- Money (future phase 2): `numeric(10,2)` — never `float`.
- Dates vs times vs timestamps:
  - `appointment_date` → `date` (calendar day in clinic TZ).
  - `start_time` / `end_time` → `time` (wall-clock in clinic TZ).
  - `created_at`, `updated_at`, etc. → `timestamptz` (always UTC).

### Prisma style
- Model names: `PascalCase`, singular (`User`, `Appointment`).
- Use `@map` to bridge Prisma PascalCase fields to snake_case columns.
- Every model has `@@map("table_name")`.
- Relations are explicit on both sides with named `@relation` when a model has more than one FK to the same table.

---

## Schema

### Enums

```prisma
enum UserRole {
  PATIENT
  ADMIN
  DENTIST
}

enum DayOfWeek {
  MON
  TUE
  WED
  THU
  FRI
  SAT
  SUN
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
}
```

### Users
Stores every account — patients, dentists, and admins. Dentists have an additional row in `dentists` linked by `user_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `email` | `varchar(255)` | unique, lowercased before insert |
| `password_hash` | `varchar(255)` | nullable (magic-link only accounts) |
| `first_name` | `varchar(100)` | |
| `last_name` | `varchar(100)` | |
| `phone` | `varchar(32)` | E.164 format, validated before WhatsApp send |
| `role` | `UserRole` | default `PATIENT` |
| `email_verified` | `boolean` | default `false`. Required `true` before booking. |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | auto-updated |

**Indexes**
- Unique on `email`.
- Index on `role` (admin patient list filters by role).

### Dentists
One-to-one extension of `users` for users with `role = DENTIST`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `users.id`, unique, `ON DELETE RESTRICT` |
| `bio` | `text` | |
| `specialisation` | `varchar(120)` | e.g. "General Dentistry", "Orthodontics" |
| `profile_photo_url` | `text` | Supabase Storage public URL |
| `is_active` | `boolean` | default `true`. Inactive dentists hidden from public list and booking flow. |
| `created_at` | `timestamptz` | default `now()` |

**Indexes**
- Unique on `user_id`.
- Index on `is_active` (public dentist list filters on this).

### Availability
Recurring weekly schedule per dentist. One row per (dentist, day of week) that they work. A dentist with Mon–Fri hours has 5 rows.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `dentist_id` | `uuid` | FK → `dentists.id`, `ON DELETE CASCADE` |
| `day_of_week` | `DayOfWeek` | |
| `start_time` | `time` | e.g. `09:00` |
| `end_time` | `time` | e.g. `17:00`. Must be `> start_time` (CHECK constraint). |
| `is_active` | `boolean` | default `true` |

**Indexes**
- Unique on `(dentist_id, day_of_week)` — one schedule row per day per dentist.
- Index on `dentist_id` for slot-generation lookups.

### Blocked dates
One-off unavailable dates per dentist (holidays, sick days, conferences).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `dentist_id` | `uuid` | FK → `dentists.id`, `ON DELETE CASCADE` |
| `date` | `date` | |
| `reason` | `varchar(255)` | nullable |
| `created_at` | `timestamptz` | default `now()` |

**Indexes**
- Unique on `(dentist_id, date)`.
- Index on `(dentist_id, date)` for slot-generation lookups (same columns, covers both).

### Services
Catalogue of services offered. Duration drives slot length.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `name` | `varchar(120)` | |
| `duration_minutes` | `integer` | must be `> 0` and a multiple of 5 (CHECK) |
| `description` | `text` | |
| `is_active` | `boolean` | default `true` |

**Indexes**
- Index on `is_active`.

### Appointments
The core transactional table.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `patient_id` | `uuid` | FK → `users.id`, `ON DELETE RESTRICT` |
| `dentist_id` | `uuid` | FK → `dentists.id`, `ON DELETE RESTRICT` |
| `service_id` | `uuid` | FK → `services.id`, `ON DELETE RESTRICT` |
| `appointment_date` | `date` | in clinic TZ |
| `start_time` | `time` | in clinic TZ |
| `end_time` | `time` | in clinic TZ, `> start_time` (CHECK) |
| `service_type` | `varchar(120)` | denormalised snapshot of the service name at time of booking |
| `status` | `AppointmentStatus` | default `PENDING` |
| `notes` | `text` | patient-visible |
| `admin_notes` | `text` | internal only; never returned to patient endpoints |
| `reminder_sent` | `boolean` | default `false` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | auto-updated |

> **Why store `service_type` as a string in addition to `service_id`?** Services can be renamed or deactivated. We want historical appointments to read correctly even if the service row changes. `service_id` is kept for analytics and joins.

**Indexes**
- `patient_id` — patient dashboard query.
- `dentist_id, appointment_date` — dentist daily schedule + slot generation.
- `appointment_date, start_time` — admin day view.
- `status` — partial indexes below filter on this.
- `reminder_sent, appointment_date` — cron reminder scan.

**Unique index (race-condition guard)**
A partial unique index prevents two active appointments from occupying the same slot for the same dentist:

```sql
CREATE UNIQUE INDEX appointments_dentist_slot_unique
ON appointments (dentist_id, appointment_date, start_time)
WHERE status IN ('PENDING', 'CONFIRMED');
```

This is the belt to the transaction's braces (see `docs/booking-flow.md`). Cancelled/completed appointments are excluded from the index so the same slot can be rebooked after cancellation.

**Reminder-scan partial index**
```sql
CREATE INDEX appointments_reminder_scan
ON appointments (appointment_date, start_time)
WHERE reminder_sent = false AND status IN ('PENDING', 'CONFIRMED');
```
Cron runs hourly and only cares about unsent reminders on active appointments.

---

## Relationships

```
users (1) ──< appointments (N) ──> (1) dentists (1) ──> (1) users
                                         │
                                         ├──< availability
                                         └──< blocked_dates

services (1) ──< appointments (N)
```

- `appointments.patient_id` → `users.id` (role = PATIENT).
- `appointments.dentist_id` → `dentists.id` (not `users.id` — go through the dentist profile row).
- `dentists.user_id` → `users.id` (role = DENTIST, unique).

---

## Integrity Rules

Enforced by a mix of DB constraints, Prisma validation, and Zod at the API edge. The DB is the last line of defence.

### At the DB
- `users.email` unique (citext or lowercased varchar).
- `dentists.user_id` unique.
- `availability (dentist_id, day_of_week)` unique.
- `blocked_dates (dentist_id, date)` unique.
- `appointments (dentist_id, appointment_date, start_time) WHERE status IN ('PENDING','CONFIRMED')` unique.
- CHECK: `availability.end_time > start_time`.
- CHECK: `appointments.end_time > start_time`.
- CHECK: `services.duration_minutes > 0`.
- FK cascade: `availability` and `blocked_dates` `CASCADE` on dentist delete (rare — we deactivate instead). Appointments `RESTRICT` — never orphan history.

### In Prisma / Zod
- Email normalised to lowercase.
- Phone validated to E.164.
- `appointment_date` must be today or later (server time in clinic TZ).
- Patient can only write to appointments where `patient_id = session.user.id`.

---

## Query Patterns

The handful of queries worth knowing well.

### Available slots for a dentist on a date
Used by `GET /api/availability`. Full algorithm in `docs/booking-flow.md`. The DB side:

```ts
// 1. Fetch the dentist's availability for that weekday.
// 2. Fetch blocked dates for that date.
// 3. Fetch existing active appointments for that dentist on that date.
const [availability, blocked, existing] = await prisma.$transaction([
  prisma.availability.findFirst({
    where: { dentistId, dayOfWeek, isActive: true },
  }),
  prisma.blockedDate.findFirst({
    where: { dentistId, date },
  }),
  prisma.appointment.findMany({
    where: {
      dentistId,
      appointmentDate: date,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { startTime: true, endTime: true },
  }),
]);
```

Slot arithmetic is done in `lib/slots.ts` (pure, unit-tested).

### Creating an appointment (race-safe)
```ts
await prisma.$transaction(async (tx) => {
  const clash = await tx.appointment.findFirst({
    where: {
      dentistId,
      appointmentDate,
      status: { in: ['PENDING', 'CONFIRMED'] },
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    },
  });
  if (clash) throw new ConflictError('Slot already booked');

  return tx.appointment.create({ data: { ... } });
}, { isolationLevel: 'Serializable' });
```
If two requests race past the app-level check, the partial unique index throws `P2002` and the transaction rolls back. Map it to `ConflictError` in the error handler.

### Patient's own appointments (IDOR-safe)
Always scope by `session.user.id`. Never trust a URL param alone.

```ts
prisma.appointment.findMany({
  where: { patientId: session.user.id },
  orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
});
```

### Reminder cron scan
```ts
const windowStart = addHours(now, 23);
const windowEnd = addHours(now, 25);

prisma.appointment.findMany({
  where: {
    reminderSent: false,
    status: { in: ['PENDING', 'CONFIRMED'] },
    // Combine date + time into a computed expression server-side,
    // or fetch by date and filter in memory for the narrow window.
    appointmentDate: { gte: startOfDay(windowStart), lte: endOfDay(windowEnd) },
  },
  include: { patient: true, dentist: { include: { user: true } } },
});
```
Each match is updated with `reminder_sent = true` in the same transaction as the send; idempotent on retries.

---

## Migrations

- One migration per PR, named with a verb: `add_blocked_dates_table`, `add_appointments_dentist_slot_unique_index`.
- Never edit a migration after it's merged. Roll forward with a new one.
- Destructive migrations (drop column, rename) require a two-step deploy:
  1. Deploy code that reads/writes both old and new.
  2. Run data backfill.
  3. Deploy code that uses only new.
  4. Drop the old column.
- Always include the down migration where possible.
- Run `pnpm db:migrate` in CI against a shadow DB before merging.

---

## Seed Data

`prisma/seed.ts` produces a usable dev DB:

- 1 admin: `admin@demo.com` / `Admin123!`
- 3 dentists with distinct specialisations and weekly schedules.
- 5 services: Checkup (30m), Cleaning (45m), Filling (60m), Root Canal (90m), Whitening (60m).
- 10 patients with realistic names, phones, verified emails.
- ~20 appointments spread across the next 2 weeks, mix of `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`.

Run: `pnpm db:seed`. Reset + reseed: `pnpm db:reset`.

Seed must be idempotent — safe to run twice without duplicating rows (use `upsert` on deterministic keys like email and service name).

---

## Backups & Environments

- **Production:** Supabase automated daily backups (retained per Supabase plan). Point-in-time recovery on paid tier when we upgrade.
- **Staging:** nightly anonymised dump from production (strip `email`, `phone`, `password_hash`, `notes`, `admin_notes`). Never restore raw prod data into staging.
- **Local dev:** seed script only. Never pull prod data locally.

---

## Security Notes

- PII columns: `email`, `phone`, `first_name`, `last_name`, `notes`, `admin_notes`. Treat all as sensitive; never log them at info level.
- `password_hash` is bcrypt, salt rounds 12. Never returned from any query — Prisma selects should explicitly omit it, and `lib/prisma.ts` registers a middleware that strips it from `User` reads.
- Row-level security (Supabase RLS) is **not** relied on — all access is through the Next.js server with explicit authorization checks. RLS is enabled as a belt-and-braces default-deny on direct DB connections.
- No raw SQL via string concatenation. If `$queryRaw` is needed, use tagged template form so Prisma parameterises.

---

## Open Questions / Future Work

- Waitlist table (Phase 2 — nice-to-have in spec).
- Invoice / payment tables (Phase 2 — Stripe).
- Audit log for admin mutations (appointment status changes, dentist edits). Likely `audit_log` table with `actor_id`, `action`, `entity`, `entity_id`, `before`, `after`, `created_at`.
- Move `service_type` snapshot into a proper `appointment_service_snapshot` JSON column if services grow more attributes (price, prep notes).
