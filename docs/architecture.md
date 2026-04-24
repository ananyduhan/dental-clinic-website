# Architecture

> System overview and data flow for the dental clinic web app.
> This document is the single source of truth for *how the system fits together*. For *how we write code*, see `CLAUDE.md`. For schema details, see `docs/database.md`. For the booking algorithm, see `docs/booking-flow.md`.

---

## 1. System Overview

A monolithic Next.js 14 (App Router) application deployed on Vercel, backed by Supabase Postgres, with two scheduled background concerns (reminders, cleanup) running on Vercel Cron.

The app serves three user roles from a single deployment:

- **Patients** — public marketing site, registration, booking, appointment management.
- **Dentists** — view their schedule and the patients on it.
- **Admins** — full management of dentists, services, patients, appointments, and exports.

There is no separate backend service. All server logic runs inside Next.js as Server Components, Server Actions, or Route Handlers. External integrations (Resend, Twilio, Supabase Storage, Upstash, Sentry) are reached via their HTTP APIs from the server runtime.

---

## 2. Architectural Principles

These principles drive every design decision below. If a future change conflicts with one of these, the principle wins unless explicitly revisited.

1. **Server-first.** Default to Server Components and Server Actions. Push to the client only when state, effects, or browser APIs require it.
2. **Thin route handlers, fat lib.** All business logic lives in `lib/`. Route handlers and Server Actions are wrappers: parse → validate → call lib → respond.
3. **Validate at every boundary.** Every input crossing a trust boundary (HTTP, form submit, webhook, cron) is validated with Zod before it reaches business logic.
4. **Defence in depth on auth.** Middleware checks sessions; every Server Action and Route Handler re-checks role and ownership. Middleware alone is never sufficient.
5. **Single source of truth for the schema.** `prisma/schema.prisma` is canonical. All DB access goes through the Prisma singleton in `lib/prisma.ts`.
6. **UTC in, local at the edge.** All timestamps stored as UTC. Conversion to `Australia/Sydney` happens in the presentation layer only.
7. **Idempotent side effects.** Reminder dispatch, email sends, and any retried operation must be safe to run more than once.
8. **No node-cron, no localStorage.** Vercel is serverless; long-running processes and browser-only storage are not options.

---

## 3. Logical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser (client)                          │
│  React Server Component HTML  +  small client islands (booking,     │
│  forms, interactive admin tables) hydrated with react-hook-form     │
└──────────────────┬──────────────────────────────────────────────────┘
                   │  HTTPS
┌──────────────────▼──────────────────────────────────────────────────┐
│                          Vercel Edge / Node                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Next.js 14 App Router                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │   (public)   │  │  (patient)   │  │       (admin)        │  │ │
│  │  │   pages      │  │   pages      │  │       pages          │  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │ │
│  │         │                 │                     │              │ │
│  │  ┌──────▼─────────────────▼─────────────────────▼───────────┐  │ │
│  │  │  Server Components  +  Server Actions  +  Route Handlers │  │ │
│  │  └──────┬──────────────────┬──────────────────┬─────────────┘  │ │
│  │         │                  │                  │                │ │
│  │  ┌──────▼──────────────────▼──────────────────▼─────────────┐  │ │
│  │  │                       lib/                                │  │ │
│  │  │  prisma · auth · slots · email · whatsapp · export ·      │  │ │
│  │  │  rate-limit · validators · errors                         │  │ │
│  │  └──────┬─────────┬──────────┬──────────┬──────────┬────────┘  │ │
│  └─────────│─────────│──────────│──────────│──────────│───────────┘ │
└────────────│─────────│──────────│──────────│──────────│─────────────┘
             │         │          │          │          │
        ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐
        │Supabase│ │Supabase│ │ Resend │ │ Twilio │ │Upstash │
        │Postgres│ │Storage │ │ (mail) │ │  (WA)  │ │ Redis  │
        └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
                                                          │
                                                     ┌────▼────┐
                                                     │ Sentry  │
                                                     │ (errors)│
                                                     └─────────┘

        Vercel Cron ──▶ /api/cron/reminders (hourly)
```

---

## 4. Route Groups & Composition

The App Router is organised into three route groups, each with its own layout and middleware-enforced auth:

| Group | Path prefix | Auth | Role gate | Layout responsibility |
|---|---|---|---|---|
| `(public)` | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password` | None | None | Marketing chrome (public navbar, footer, large-format hero styling). |
| `(patient)` | `/dashboard`, `/book`, `/appointments`, `/profile` | Required | `PATIENT` (admins/dentists redirected to `/admin`) | Patient app shell with side nav and account menu. |
| `(admin)` | `/admin/*` | Required | `ADMIN` or `DENTIST` (dentists see scoped views) | Admin shell with role-aware navigation. |

API routes under `app/api/` are reserved for things that **can't** be Server Actions:

- Webhooks (Resend delivery events, Twilio status callbacks).
- Vercel Cron endpoints (reminders, future cleanup jobs).
- File downloads (`/api/admin/export` returns an `.xlsx` stream).
- NextAuth's own handler (`/api/auth/[...nextauth]`).

Everything else — booking, cancellation, profile updates, dentist management — is a Server Action invoked from a form or button.

---

## 5. Request Lifecycles

### 5.1 Patient books an appointment

```
Patient (browser)
    │  selects service → dentist → date → time
    │  submits multi-step form
    ▼
Server Action: createAppointment()
    │  1. Re-check session.user.id and role === PATIENT
    │  2. Zod-validate { serviceId, dentistId, date, startTime, notes }
    │  3. Rate-limit by user (Upstash)
    │  4. Refuse if email_verified === false
    │  ▼
lib/slots.ts: assertSlotAvailable()
    │  Recomputes available slots server-side at submission time.
    │  (The client may have stale data.)
    │  ▼
Prisma transaction
    │  - SELECT overlapping appointments FOR UPDATE
    │  - INSERT appointment (status = PENDING)
    │  - Unique partial index on (dentist_id, appointment_date, start_time)
    │    catches any race that slips through.
    ▼
lib/email.ts: sendBookingConfirmation()  (fire-and-forget, errors logged)
    ▼
Return appointment → redirect to /appointments?booked={id}
```

The 24h-before reminder is **not** scheduled inline. The hourly cron picks it up later by querying `appointment_date + start_time` against `now()`.

### 5.2 Hourly reminder cron

```
Vercel Cron (hourly, configured in vercel.json)
    │  GET /api/cron/reminders
    │  Authorization: Bearer ${CRON_SECRET}
    ▼
Route handler: app/api/cron/reminders/route.ts
    │  1. Reject if header doesn't match CRON_SECRET (constant-time compare).
    │  2. Query appointments where:
    │       appointment_date + start_time BETWEEN now() + 23h AND now() + 25h
    │       AND reminder_sent = false
    │       AND status IN ('PENDING','CONFIRMED')
    │     LIMIT 100  (process more in next tick if backlog).
    │  ▼
For each appointment (sequential, in a transaction per-row):
    │  - Send WhatsApp via lib/whatsapp.ts
    │      ↳ on failure: log to Sentry, continue
    │  - Send email via lib/email.ts
    │      ↳ on failure: log to Sentry, continue
    │  - UPDATE appointments SET reminder_sent = true WHERE id = ? AND reminder_sent = false
    ▼
Return { processed: N }
```

`reminder_sent = true` is the idempotency flag. If WhatsApp succeeds but email fails (or vice versa), we still mark sent and rely on Sentry for follow-up. The alternative — two flags — adds complexity for a corner case operations can handle manually.

### 5.3 Admin exports appointments to Excel

```
Admin clicks "Export"
    ▼
GET /api/admin/export?from=YYYY-MM-DD&to=YYYY-MM-DD&dentistId=...
    │  Route handler (not Server Action — needs to stream a file)
    │  1. requireRole('ADMIN')
    │  2. Zod-validate query params (date format, range ≤ 1 year)
    │  3. Query appointments joined with patient + dentist + service
    │  4. lib/export.ts builds workbook with `xlsx`
    │  5. Stream as
    │       Content-Type: application/vnd.openxmlformats-...sheet
    │       Content-Disposition: attachment; filename="appointments-YYYY-MM-DD.xlsx"
```

---

## 6. Data Architecture

The full schema lives in `prisma/schema.prisma`; this section covers the relationships and the rules that don't fit in Prisma syntax.

### 6.1 Entity relationships

```
users ──┬──< appointments (as patient)
        └──1:1── dentists ──┬──< availability  (weekly recurring)
                            ├──< blocked_dates (one-off overrides)
                            └──< appointments  (as dentist)

services ──< appointments
```

### 6.2 Critical invariants enforced at the DB level

| Invariant | Mechanism |
|---|---|
| No two PENDING/CONFIRMED appointments can share `(dentist_id, appointment_date, start_time)` | Unique partial index `WHERE status IN ('PENDING','CONFIRMED')` |
| Foreign keys never dangle | `ON DELETE RESTRICT` for `appointments.patient_id` and `appointments.dentist_id` (we soft-delete dentists, never hard-delete patients) |
| Email uniqueness is case-insensitive | `CREATE UNIQUE INDEX ... ON users (LOWER(email))` |
| `start_time < end_time` for availability and appointments | CHECK constraint |

### 6.3 Soft deletes

We do not hard-delete patients, dentists, or appointments. Instead:

- **Dentists:** `is_active = false` removes them from public listings and the booking flow but preserves history.
- **Services:** same pattern (`is_active`).
- **Appointments:** status moves to `CANCELLED`; row is retained for audit.
- **Patients:** there is no patient delete in the MVP. If GDPR-style erasure is needed later, it gets its own job.

### 6.4 Timezones

- All `timestamp` and `time` columns are UTC.
- The clinic operates in `Australia/Sydney`. Conversion happens in two places only:
  - **Inbound:** when the booking form submits a date+time, the client converts the patient's selection from Sydney time to UTC before submitting (or sends Sydney-local + offset and the server converts).
  - **Outbound:** when rendering for users, we format with `date-fns-tz` using `Australia/Sydney`.
- DST transitions: slot generation refuses to create slots that fall in the non-existent hour and de-duplicates the repeated hour. The unit tests in `lib/slots.test.ts` cover both transition days.

---

## 7. Authentication & Authorization

### 7.1 Authentication

- **NextAuth.js v5** with two providers: credentials (email + password, bcrypt salt rounds 12) and email magic link (Resend).
- Sessions are JWT, stored in an `httpOnly`, `Secure`, `SameSite=Lax` cookie.
- Email verification is required before `(patient)` actions that create data — most importantly `createAppointment`. Login itself does not require verification (so unverified users can return to verify).

### 7.2 Authorization (defence in depth)

Three layers, in order of execution:

1. **Middleware (`middleware.ts`):** for `(patient)` and `(admin)` route groups, redirects unauthenticated users to `/login?next=...`. Cheap; coarse.
2. **Server Component data loaders:** call `requireRole(...)` from `lib/auth.ts` before fetching. Returns the typed session or throws.
3. **Server Actions and Route Handlers:** call `requireRole(...)` again, regardless of where they're invoked from. This is the only layer we trust.

For row-level access (a patient viewing their own appointments), every query filters by `session.user.id`. URL-supplied IDs are *never* used to scope queries — they're only used for lookups whose result is then verified to belong to the current user. This prevents IDOR.

```ts
// Wrong — vulnerable to IDOR
const appt = await prisma.appointment.findUnique({ where: { id: params.id } });

// Right
const appt = await prisma.appointment.findFirst({
  where: { id: params.id, patientId: session.user.id },
});
if (!appt) throw new NotFoundError();
```

### 7.3 Role matrix

| Action | PATIENT | DENTIST | ADMIN |
|---|---|---|---|
| Book / cancel own appointment | ✅ | — | — |
| View own appointments | ✅ | — | — |
| View own schedule | — | ✅ (their own) | ✅ (any) |
| View patient details | — | ✅ (only patients with appointments with them) | ✅ |
| Manage dentists / services | — | — | ✅ |
| Manage availability / blocked dates | — | ✅ (own only) | ✅ (any) |
| Change appointment status | — | ✅ (own only) | ✅ |
| Export appointments | — | — | ✅ |

---

## 8. External Integrations

Each integration is wrapped in a single module under `lib/` so the rest of the app never touches the SDK directly. This isolates retry/error/logging concerns and makes swapping a provider a one-file change.

| Integration | Module | Purpose | Failure mode |
|---|---|---|---|
| Resend | `lib/email.ts` | Transactional email (verify, booking confirmations, status changes, reminders, password reset) | Log to Sentry; do not block the user-facing action. |
| Twilio WhatsApp | `lib/whatsapp.ts` | 24h reminders | Log to Sentry; email reminder still goes out. |
| Supabase Storage | `lib/storage.ts` | Dentist profile photos | Upload failure surfaces to admin form with clear error. |
| Upstash Redis | `lib/rate-limit.ts` | Rate limiting (auth: 5/15min by IP+email; booking: 10/hour by user) | If Redis is unreachable, fail open with a Sentry warning — better than blocking the whole app. |
| Sentry | `lib/observability.ts` | Error + performance monitoring | N/A — Sentry is the bottom of the stack. |

Webhooks from Resend and Twilio (delivery status, failure callbacks) land at `/api/webhooks/{resend,twilio}` and update appointment-level delivery status. Both verify the provider's signature header before processing.

---

## 9. Background Jobs

All background work runs as serverless function invocations triggered by **Vercel Cron** — there are no long-running processes.

| Job | Endpoint | Schedule | Purpose |
|---|---|---|---|
| Reminders | `/api/cron/reminders` | hourly | Send 24h-before WhatsApp + email. |
| (Future) Magic-link cleanup | `/api/cron/cleanup-tokens` | daily | Purge expired NextAuth tokens. |
| (Future) No-show flagging | `/api/cron/mark-no-shows` | daily | Move past PENDING/CONFIRMED appointments to a `NO_SHOW` status. |

Every cron endpoint:

- Verifies `Authorization: Bearer ${CRON_SECRET}`.
- Has a hard ceiling on rows processed per invocation (default 100) so a backlog doesn't blow the function timeout.
- Is idempotent — re-running after a failure must not double-send or corrupt state.

---

## 10. Slot Generation (overview)

Full algorithm, edge cases, and test matrix live in `docs/booking-flow.md`. The high-level flow:

```
inputs:  dentistId, date, serviceId
outputs: ordered list of available start times (in clinic TZ)

1. Fetch dentist availability for the day-of-week.
   If none → return [].
2. Fetch blocked_dates for (dentistId, date).
   If matched → return [].
3. Generate candidate slots from start_time to end_time
   in steps equal to service.duration_minutes.
   Exclude slots that would end after end_time.
4. Subtract slots that overlap any existing appointment for that dentist
   on that date with status in (PENDING, CONFIRMED).
5. If date is today, drop slots whose start has already passed.
6. Return remaining slots.
```

This is a pure function. The Prisma queries that feed it are in `lib/availability.ts`; the generator itself in `lib/slots.ts` is fully unit-tested with no DB dependency.

The displayed slots are advisory. **Server-side re-checking at booking time is mandatory** — see §5.1.

---

## 11. Error Handling

### 11.1 Typed errors

All errors thrown from `lib/` use the typed hierarchy in `lib/errors.ts`:

- `ValidationError` → 400
- `UnauthorizedError` → 401
- `ForbiddenError` → 403
- `NotFoundError` → 404
- `ConflictError` → 409 (used for slot collisions)
- `RateLimitError` → 429

A single error mapper in `lib/error-handler.ts` translates these to HTTP responses for route handlers, and to typed Server Action return values (`{ ok: false, error: ... }`) for forms. The client form layer maps action errors back to inline field errors via the same Zod schema used to validate.

### 11.2 What the user sees vs. what we log

- **User:** clear, action-oriented messages. Never raw Prisma errors. Never stack traces.
- **Sentry:** every 5xx and every caught-but-logged exception (e.g. WhatsApp failure during a reminder), with request context (route, user id, request id).

---

## 12. Observability

- **Errors:** Sentry, with environment + release tagging from Vercel build metadata.
- **Logs:** structured (JSON) via `lib/logger.ts`. In production, Vercel's log drain to a third-party (TBD) — until then, Vercel's built-in log viewer is the source.
- **Performance:** Vercel Web Analytics for page-level Core Web Vitals; Sentry Performance for server-side spans.
- **Health check:** `/api/health` returns 200 with `{ status: 'ok', db: 'ok' }` after a `SELECT 1`. Used by uptime monitoring.

---

## 13. Security Posture

Detailed checklist lives in `docs/security.md`; the architectural commitments are:

- **Secrets** never appear in client bundles. Only `NEXT_PUBLIC_*` is shipped to the browser, and that prefix is reserved for genuinely public values (app URL, Sentry DSN).
- **CSRF** handled by NextAuth + Server Actions' built-in form-token model.
- **Rate limiting** on auth endpoints, password reset, and booking creation via Upstash.
- **Content Security Policy** set in `next.config.js` — no inline scripts except those Next.js itself emits with nonces.
- **Input sanitisation:** all rendered user content uses React's default escaping; no `dangerouslySetInnerHTML` without a vetted sanitiser.
- **Dependencies** scanned by Dependabot weekly; security advisories trigger an immediate PR.

---

## 14. Environments

| Environment | Purpose | DB | Email/WA | Cron |
|---|---|---|---|---|
| **Local** | Dev | Supabase local Docker or shared dev project | Resend in test mode; Twilio sandbox | Disabled (manual `pnpm exec tsx jobs/run-reminders.ts`) |
| **Preview** | Per-PR Vercel preview | Shared dev DB (read-write, seeded) | Resend test mode; Twilio sandbox | Disabled |
| **Production** | Live | Supabase prod project | Resend live; Twilio live | Enabled |

Promotion is via Vercel's standard preview→production flow on `main`. Database migrations run as a step in the production deploy via `prisma migrate deploy` — never `db push`.

---

## 15. Deployment Topology

- **Vercel** hosts the Next.js app. Server Components and Server Actions run on the Node runtime (not Edge — we need Prisma and the Twilio SDK).
- **Supabase** hosts Postgres and object storage. The DB connection from Vercel uses connection pooling (PgBouncer in transaction mode) via the pooled connection string; long-lived connections use the direct URL where required by Prisma migrations.
- **Vercel Cron** triggers HTTPS calls back into the same deployment.
- **Upstash, Resend, Twilio, Sentry** are reached from server runtime over HTTPS using credentials in Vercel environment variables.

There is intentionally no Kubernetes, no separate worker tier, no message queue. The volume justifies none of it. If we outgrow Vercel function timeouts for cron processing, the next step is a queue (likely Upstash QStash) — not a custom service.

---

## 16. What's Explicitly Out of Scope

These are deferred to phase 2 and should not be built into the architecture preemptively:

- Google Calendar two-way sync.
- SMS fallback when WhatsApp fails.
- Online deposits (Stripe).
- Patient mobile app.
- Reviews and ratings.
- Invoice PDF generation.
- Waitlist for full slots.

When any of these lands on the roadmap, revisit this document — several of them (Stripe, waitlist) imply new state and new background jobs.

---

## 17. Change Log

| Date | Change | Author |
|---|---|---|
| _initial_ | First version derived from `dental-clinic-spec.md` and `CLAUDE.md`. | — |
