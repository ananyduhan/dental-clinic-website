# BrightSmile Dental

A production web app for a dental clinic: public marketing site, patient
registration and login, a multi-step booking flow with real-time slot
availability, an admin and dentist dashboard, automated 24-hour reminders over
email and WhatsApp, and Excel export.

**Status: pre-launch.** The code is treated as production from day one — see
[`CLAUDE.md`](./CLAUDE.md) for the conventions every change follows.

---

## Stack

Next.js 14 (App Router, TypeScript strict) · Tailwind + shadcn/ui ·
PostgreSQL on Supabase · Prisma · NextAuth v5 · Zod · Resend · Twilio WhatsApp ·
Vercel Cron · Upstash Redis · Sentry · Vitest + Playwright · Vercel (`syd1`).

Clinic timezone is **Australia/Sydney**. Everything in the database is UTC;
conversion happens at the edges only, via `date-fns-tz`.

---

## Getting started

```bash
pnpm install
cp .env.example .env          # then fill in the values below
pnpm prisma generate
pnpm prisma migrate deploy    # NOT `migrate dev` — see the warning below
pnpm db:seed
pnpm dev
```

The app runs at http://localhost:3000.

Seeded logins: `admin@demo.com` / `Admin123!` and `patient1@demo.com` …
`patient10@demo.com` / `Patient123!`.

### The minimum `.env` to boot

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Pooled connection (PgBouncer, port 6543) — app runtime |
| `DIRECT_URL` | Direct connection (port 5432) — migrations only |
| `AUTH_SECRET` | NextAuth session signing (`openssl rand -base64 32`) |
| `CRON_SECRET` | Guards `/api/cron/reminders` |
| `CLINIC_TIMEZONE` | `Australia/Sydney` |

Everything else degrades gracefully:

- **No `RESEND_API_KEY`** — outside production, emails (including verification
  and reminder links) print to the console instead of sending. This is
  deliberate, so the register → verify → login flow works without a Resend
  account. In production a missing key throws, because silently dropping a
  password reset is worse than a failed request.
- **No Twilio credentials** — WhatsApp sends throw, the reminder sweep logs the
  failure and still sends the email.
- **No Upstash** — rate limiting fails *open* and logs a warning. An outage at
  the rate limiter should not lock every patient out of login.
- **No Sentry DSN** — the SDK is never initialised.

---

## Commands

```bash
pnpm dev                # dev server
pnpm build              # production build
pnpm start              # run the production build

pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint
pnpm format             # prettier

pnpm test               # vitest — unit only, hermetic, no network
pnpm test:integration   # vitest — real database (skips if no DATABASE_URL)
pnpm e2e                # playwright — real browser, real server

pnpm db:migrate         # prisma migrate dev  — read the warning first
pnpm db:studio          # prisma studio
pnpm db:seed            # seed script
pnpm db:reset           # reset + reseed (dev only)
```

**Before declaring any task done:** `pnpm typecheck && pnpm lint && pnpm test`.
`pnpm build` is worth adding — it has caught things `tsc` alone did not.

Playwright needs its browser once: `npx playwright install chromium`.

---

## ⚠️ Never run `prisma migrate dev` without reading the generated SQL

The `appointments` table has a **partial** unique index that Prisma's schema
language cannot express:

```sql
CREATE UNIQUE INDEX appointments_active_slot_unique
ON appointments (dentist_id, appointment_date, start_time)
WHERE status IN ('PENDING', 'CONFIRMED');
```

It has to be partial. An unconditional unique index counts `CANCELLED` rows, so
once a patient cancelled a 09:00 slot **nobody could ever book it again**.

Because Prisma does not know the index exists, `migrate dev` diffs the shadow
database against `schema.prisma`, sees it as drift, and generates a migration
that **drops it**. So:

- Use `prisma migrate deploy` to apply migrations.
- If you must run `migrate dev` to author a new one, open the generated SQL and
  delete any `DROP INDEX "appointments_active_slot_unique"`.

---

## Architecture in one page

```
app/
  (public)/     landing, login, register, verify, password reset
  (patient)/    dashboard, book, appointments, profile   — role = PATIENT
  (admin)/      admin/*                                  — role = ADMIN | DENTIST
  api/          route handlers: webhooks, cron, downloads, external callers
lib/
  slots.ts          pure slot generation — no DB, no `new Date()`
  availability.ts   the DB wrapper around it
  appointments/     create · transition · queries · notes · actor · time
  actions/          Server Actions (all user-initiated mutations)
  admin/            dentist, service, and roster management
  validators/       Zod schemas, one file per domain
  reminders.ts      the hourly sweep
```

**Mutations are Server Actions.** Route handlers exist only for cron, file
downloads, webhooks, and external callers — see `docs/api-conventions.md`.

**Three rules worth knowing before changing anything:**

1. `lib/appointments/transition.ts` is the only code that writes
   `appointments.status`. Every rule about who may do what, and when, lives
   there.
2. Slot generation is pure and takes an injected `now`. The DB seam is
   `lib/availability.ts`. Keep them separate — that split is what makes the DST
   behaviour testable.
3. Every query a patient can reach is scoped by `session.user.id`, never by a
   URL parameter. Asking for someone else's appointment returns `NOT_FOUND`,
   not `FORBIDDEN`.

---

## Booking, briefly

A 5-step wizard. Slots are generated on a 15-minute grid (not by service
duration — stepping by duration silently hides valid slots), filtered against
existing appointments with strict inequalities so back-to-back bookings are
legal, and both daylight-saving transitions are handled explicitly.

Double-booking is prevented at three layers: an optimistic re-check, a
`Serializable` transaction retried once on a write conflict, and the partial
unique index above. `tests/integration/booking.race.test.ts` fires concurrent
bookings at one slot and asserts exactly one wins.

Full detail: [`docs/booking-flow.md`](./docs/booking-flow.md).

---

## Reminders

Vercel Cron hits `/api/cron/reminders` hourly (`vercel.json`). The endpoint
verifies `Authorization: Bearer ${CRON_SECRET}` **before touching the
database**, then sweeps appointments starting 23–25 hours out.

Delivery is deliberately **at-most-once**: each appointment is claimed with a
conditional update before any message is sent, so a retried or overlapping
invocation cannot message a patient twice. If both providers fail the reminder
is still marked sent and Sentry is alerted — a late reminder is worse than none,
and ops calls the patient.

```bash
# locally
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reminders
```

---

## Testing

| Layer | Command | What it touches |
|---|---|---|
| Unit | `pnpm test` | Nothing external. Slot engine, state machine, errors, tokens. |
| Integration | `pnpm test:integration` | The real database. Race conditions, transitions, the reminder sweep. Skips itself when `DATABASE_URL` is unset. |
| E2E | `pnpm e2e` | A real browser against a production build. |

Integration and e2e suites create their own rows and remove them again, so a run
leaves the seed data as it found it.

---

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — conventions, the definition of done
- [`docs/architecture.md`](./docs/architecture.md) — system overview
- [`docs/design-system.md`](./docs/design-system.md) — colours, type, spacing
- [`docs/database.md`](./docs/database.md) — schema, indexes, conventions
- [`docs/api-conventions.md`](./docs/api-conventions.md) — response shapes, status codes
- [`docs/security.md`](./docs/security.md) — auth, rate limiting, secrets
- [`docs/booking-flow.md`](./docs/booking-flow.md) — slots, races, state machine
- [`docs/runbook.md`](./docs/runbook.md) — operational procedures
- [`docs/backend-completion-plan.md`](./docs/backend-completion-plan.md) — how the
  server tier was built, and what is still open

---

## Deploying

Vercel, region `syd1` — pinned in `vercel.json` so functions sit next to the
Sydney database rather than defaulting to Washington DC. Set every variable from
`.env.example` in the Vercel dashboard, then merge to `main`.

Deploy checklist and rollback procedure: [`docs/runbook.md`](./docs/runbook.md).
