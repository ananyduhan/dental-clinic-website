# Backend Completion Plan

> Working plan to take this project from "high-fidelity prototype" to "functioning
> application". Scope is the **server tier only** — the UI is ~90% built and is
> touched here only where it must be unwired from mock data.
>
> Written 2026-08-25. Grounded in `docs/api-conventions.md`, `docs/booking-flow.md`,
> `docs/security.md`, and `CLAUDE.md`. Where this plan and those docs disagree, the
> docs win — except where noted under "Contract decisions", which are open items
> that need a human call.

---

## Where the project actually stands

| Layer | State |
|---|---|
| Design system, UI components, pages | ~90% — complete and good |
| Prisma schema, seed script | ~95% — one bug, one missing column |
| `lib/` helpers (email, whatsapp, export, rate-limit, errors, auth config) | ~85% — written, but nothing calls them |
| Zod validators | ~90% — auth aligned to `security.md`; booking fields still drift |
| **API route handlers** | **~0% — all 10 are `return Response.json({ data: null })`** |
| **Server actions** | **0% — none exist** |
| Middleware | ✅ done (Phase 1) |
| Migrations | ✅ applied to Supabase; partial index verified in-database |
| Tests | ~35% — 67 unit tests; no integration, no Playwright e2e |
| Deploy/observability | ~10% — no `vercel.json`, Sentry installed but unconfigured |

**Overall: ~40%.** The presentation half is nearly done; the functional half is
barely started. Everything a user can *see* works. Nothing a user can *do* works.

---

## Three findings that shape this plan

These came out of reading the specs against the code. They are not style nits —
each one changes what gets built.

### 1. The slot engine does not match its own spec

`lib/slots.ts` is clean, pure, and unit-tested — but it implements a different
algorithm than `docs/booking-flow.md` describes.

| `docs/booking-flow.md` requires | `lib/slots.ts` currently does |
|---|---|
| `startUtc` / `endUtc` as `Date` objects | `"HH:mm"` strings |
| Timezone conversion via `date-fns-tz` | No timezone handling at all |
| Steps by 15 min (`stepMinutes`, configurable) | Steps by `serviceDurationMinutes` |
| Inputs: `availability`, `blockedDates`, injected `now`, `timezone` | Bare start/end time strings |
| DST spring-forward / fall-back handling | None |

The doc explains why the 15-minute grid matters: stepping by duration means that
if a 30-min checkup sits at 09:00, a patient wanting a 60-min filling is offered
09:30–10:30 only — silently missing that 10:00–11:00 is also valid.

**Consequence:** Phase 3 is a rewrite, not a wiring job. The existing tests get
replaced too. Budget accordingly.

### 2. The unique constraint was a live bug (fixed in Phase 0)

`prisma/schema.prisma` had:

```prisma
@@unique([dentistId, appointmentDate, startTime])
```

Unconditional — it counts `CANCELLED` rows. **Once a patient cancelled a 09:00
slot, that slot could never be booked again by anyone.** `docs/booking-flow.md`
specifies a *partial* index scoped to active statuses. Prisma's DSL cannot
express `WHERE`, so it must be raw SQL in the migration.

Fixed in Phase 0. See "Known Prisma limitation" below for the ongoing care this
needs.

### 3. Contract mismatches to settle before writing 10 handlers against them

| Thing | `docs/` says | Code says | Action |
|---|---|---|---|
| Error response shape | `{ error: { code, message, details } }` | `types/index.ts` → `{ error: string, code, details }` | Adopt the doc shape |
| Error helper | `handleApiError(err)` → `NextResponse` | `lib/errors.ts` exports `toHttpError()` | Add `handleApiError`, keep `toHttpError` as its internal |
| Validator file | `lib/validators/booking.ts` | `lib/validators/appointment.ts` | Keep the existing filename; align the fields |
| Date field | `date` | `appointmentDate` | Pick one — see below |
| `dentistId` | `.uuid().nullable()` (null = no preference) | `.uuid()` — **required** | **Must become nullable** |

That last row is a functional bug, not a naming quibble: `booking-form.tsx:38`
already renders a "No preference" option, and the current schema makes it
impossible to submit.

---

## Phase 0 — Make it runnable ✅ DONE

Nothing could be verified before this; `node_modules` was absent, so `pnpm
typecheck` / `lint` / `test` could not run at all.

| # | Step | Result |
|---|---|---|
| 0.1 | `pnpm install` | ✅ done in 4.1s |
| 0.2 | `.env` created from `.env.example`; `AUTH_SECRET` + `CRON_SECRET` generated | ✅ done (`.env` is gitignored) |
| 0.3 | `CLINIC_TIMEZONE=Australia/Sydney` added to `.env` **and** `.env.example` | ✅ done — `booking-flow.md` requires it from env; it was missing |
| 0.4 | `pnpm prisma generate` | ✅ done — this was the hard blocker on typecheck |
| 0.5 | Removed the over-broad `@@unique`; added the partial index as raw SQL | ✅ done |
| 0.6 | Hand-authored `prisma/migrations/20260825000000_init/migration.sql` (176 lines, 8 tables) via `prisma migrate diff --from-empty`, offline | ✅ done |
| 0.7 | `pnpm prisma validate` | ✅ valid |
| 0.8 | Fixed `prisma/seed.ts:232` — its `upsert` keyed off the compound `@@unique` removed in 0.5. Replaced with `createMany` (the seed already truncates every table first, so there was nothing to upsert against) | ✅ done — caught by `pnpm build` |
| 0.9 | Baseline `typecheck` / `lint` / `test` / `build` | ✅ **all four green — 0 type errors, 0 lint errors, 9/9 tests, clean production build** |
| 0.10 | `prisma migrate deploy` + `pnpm db:seed` against Supabase | ✅ **done** — 8 tables created, partial index verified in-database, 14 users / 3 dentists / 5 services / 20 appointments seeded |

`pnpm build` is now part of the baseline even though `CLAUDE.md` only mandates
typecheck/lint/test. It earned its place immediately: it was the only check that
caught the stale `upsert` in the seed, because `tsc` had been run against a
Prisma client generated *before* the schema edit.

### Database setup, as actually performed

Supabase project in `ap-southeast-2` (Sydney). Two connection
strings are required and `prisma/schema.prisma` now declares both:

```prisma
url       = env("DATABASE_URL")   // pooled, port 6543 — app runtime
directUrl = env("DIRECT_URL")     // direct, port 5432 — migrations only
```

Migrations must bypass PgBouncer: its transaction pooler does not support the
advisory locks and prepared statements `prisma migrate` relies on. Runtime
queries must *use* the pooler, because serverless functions open far more
connections than a direct link survives.

Seeded logins: `admin@demo.com` / `Admin123!`, `patient1@demo.com` …
`patient10@demo.com` / `Patient123!`.

### Debugging note: P1001 does not always mean "unreachable"

The first connection attempt failed with:

```
P1001: Can't reach database server at `aws-0-ap-northeast-1.pooler.supabase.com:5432`
```

which is misleading. DNS resolved, TCP was open on both 6543 and 5432, and the
project's REST endpoint returned 401 (healthy — "missing apikey"). The actual
cause was that the password was still the dashboard's `[YOUR-PASSWORD]`
placeholder. The pooler is a shared load balancer that accepts the TCP connection
from anyone and only then fails the tenant handshake, which Prisma surfaces as
P1001 rather than an auth error.

**When you see P1001 against Supabase, check the credentials before the network.**
A quick triage that does not print secrets:

```bash
set -a; . ./.env; set +a
nc -z <host> 5432                      # TCP open?  -> not a network problem
curl -s -o /dev/null -w '%{http_code}' https://<project-ref>.supabase.co/rest/v1/
                                       # 401 = project live; 503 = paused
```

### Region: moved Tokyo -> Sydney

The project was originally created in `ap-northeast-1` (Tokyo) while the clinic
timezone is `Australia/Sydney`. Measured from a Sydney machine:

| Region | TCP connect |
|---|---|
| `ap-northeast-1` (Tokyo) | 222 ms |
| `ap-southeast-2` (Sydney) | **30 ms** |

7.4x, about 192 ms of pure round-trip on every database call.

Supabase cannot change a project's region in place — a project is tied to the
infrastructure it was provisioned on, and Project Transfers move projects between
*organizations*, not regions. The fix was to recreate in `ap-southeast-2`. The
official backup/restore migration guide did not apply: the database held only
seed data, so it was a recreate plus `migrate deploy` and `db:seed`.

**In production the latency that matters is Vercel function -> Supabase, not
browser -> Supabase**, and Vercel defaults to `iad1` (Washington DC). Deploying
with defaults against a Tokyo database would have meant US functions, Japanese
database, Australian patients. `vercel.json` now pins functions to `syd1` so they
are co-located with the database and close to patients. Phase 6 adds the cron
entry to that same file — omitted for now because a cron pointing at a
nonexistent `/api/cron/reminders` would fail to deploy.

The project ref lives only in `.env`; nothing in the repo hardcodes it, so the
move was a two-line change.

### Known Prisma limitation — read before running `migrate dev`

Prisma does not know about the partial index, because its DSL cannot represent
one. `prisma migrate dev` builds a shadow database from the migration history and
diffs it against `schema.prisma` — so it will see `appointments_active_slot_unique`
as drift and **try to generate a migration that drops it.**

Rules going forward:

- Use `prisma migrate deploy` to apply migrations.
- When you do run `migrate dev` to author a *new* migration, **always read the
  generated SQL** and delete any `DROP INDEX "appointments_active_slot_unique"`.
- The index definition is commented in-place in the init migration so the reason
  survives contact with whoever hits this next.

---

## Phase 1 — Shared foundation ✅ DONE

Everything downstream imports these. Built first so Phases 2–6 do not refactor twice.

| File | Action | Result |
|---|---|---|
| `lib/constants.ts` | **new** | ✅ `CLINIC_TIMEZONE` (env, validated against `Intl`), `SLOT_STEP_MINUTES`, `CANCELLATION_WINDOW_MS`, reminder window, page-size caps |
| `lib/auth.config.ts` | **new** | ✅ Edge-safe NextAuth config + path predicates — **see "The middleware problem" below** |
| `lib/auth.ts` | refactor | ✅ Spreads `authConfig`; keeps only the Credentials provider and `requireRole` |
| `middleware.ts` | **new** | ✅ Session gate with `callbackUrl` preservation and a patient→`/dashboard` bounce off `/admin` |
| `lib/errors.ts` | extend | ✅ `handleApiError()`, `SlotNoLongerAvailableError`, Zod → 422 with field details, Prisma P2002/P2003/P2025 mapping, `ValidationError.details` |
| `types/index.ts` | fix | ✅ `ApiError` → the nested `{ error: { code, message, details } }` shape |
| `lib/rate-limit.ts` | fix | ✅ Lazy Redis + limiters; `checkRateLimit` fails **open** and logs |
| `app/(public)/login/page.tsx` | fix | ✅ Reads `callbackUrl` (was reading `next`, which nothing sets) + open-redirect guard |
| `tests/unit/errors.test.ts` | **new** | ✅ 27 tests |
| `next.config.mjs` | fix | ✅ `serverComponentsExternalPackages: ["@sentry/nextjs"]` — the lazy Sentry import otherwise emits an OpenTelemetry "Critical dependency" warning on every build |

**Gate met:** `typecheck` ✅ · `lint` ✅ · `test` ✅ **36/36** (was 9) · `build` ✅

Verified live against `pnpm dev`: all six protected paths 307 to
`/login?callbackUrl=…` with query strings preserved; `/`, `/login`, `/register`
serve 200.

### The middleware problem, and why `lib/auth.config.ts` exists

`middleware.ts` could not simply import `lib/auth.ts`. Next 14 middleware runs on
the **edge runtime**, and `lib/auth.ts` imports Prisma Client and bcrypt, neither
of which runs there. This is the standard NextAuth v5 split:

- **`lib/auth.config.ts`** — pure. Session strategy, pages, `jwt`/`session`
  callbacks, path predicates. Only *type* imports from `@prisma/client`, which
  are erased at compile time. This is what middleware instantiates.
- **`lib/auth.ts`** — spreads `authConfig`, adds the Credentials provider (Prisma
  + bcrypt). Used from route handlers, server components, and server actions.

Verified by grepping the built edge bundle (`.next/server/middleware.js`, 236 KB):
**0 occurrences of `PrismaClient`, `prisma`, or `bcrypt`.**

Keep the callbacks in `auth.config.ts` only. Redeclaring them in `auth.ts` would
silently shadow the shared ones and drift the token shape between middleware and
the app.

### Middleware is a UX gate, not the authorization boundary

It reads the JWT and nothing else, so it cannot see a demotion: a user downgraded
from ADMIN to PATIENT keeps an ADMIN token until it expires. `CLAUDE.md` is
explicit — **every server action and route handler re-checks the role itself.**
Phase 5 does not get to lean on this.

### Two deviations from the original plan

1. **`checkRateLimit` fails open, not closed.** If Upstash is unconfigured or
   unreachable, requests are allowed and a warning is logged. An outage at the
   rate limiter should not lock every user out of login. This is a deliberate
   availability-over-strictness trade; `docs/security.md` treats rate limiting as
   defence in depth rather than the only lock on the door. Revisit if abuse
   becomes real.
2. **`authRateLimiter` / `bookingRateLimiter` are now `getAuthRateLimiter()` /
   `getBookingRateLimiter()`.** Const exports cannot be lazy. Nothing imported
   them yet, so there was no breakage — but Phase 2 should use the getters.

---

## Phase 2 — Auth completion ✅ DONE

**This was the highest-urgency gap: no user could create an account.** The
registration UI POSTed to an endpoint that did not exist, so the only users in
the system were the ones `prisma/seed.ts` inserts.

| File | Action | Result |
|---|---|---|
| `lib/tokens.ts` | **new** | ✅ 32-byte CSPRNG tokens, SHA-256 hashed for storage, TTL constants |
| `lib/accounts.ts` | **new** | ✅ `registerPatient`, `verifyEmail`, `requestPasswordReset`, `resetPassword` |
| `app/api/auth/register/route.ts` | **new** | ✅ bcrypt 12, 3/hour per IP |
| `app/api/auth/verify-email/route.ts` | **new** | ✅ redirects to `/verify-email?status=…` |
| `app/api/auth/forgot-password/route.ts` | **new** | ✅ always 200, 3/hour per email |
| `app/api/auth/reset-password/route.ts` | **new** | ✅ single-use, 5/hour per IP |
| `app/(public)/verify-email/page.tsx` | **new** | ✅ four states, no token handling |
| `lib/rate-limit.ts` | refactor | ✅ registry of all 7 limits from `security.md`; `enforceRateLimit`, `clientIpFrom` |
| `lib/errors.ts` | extend | ✅ `Retry-After` on 429 |
| `lib/email.ts`, `lib/whatsapp.ts` | fix | ✅ lazy clients — **see below** |
| `lib/validators/auth.ts` | fix | ✅ password min 8 → **10**, per `security.md:32` |
| 3 × public pages | fix | ✅ read `error.message`, not `error` as a string |
| `tests/unit/{tokens,accounts}.test.ts` | **new** | ✅ 31 tests |

**Gate met:** `typecheck` ✅ · `lint` ✅ · `test` ✅ **67/67** (was 36) · `build` ✅

Verified live against `pnpm dev`:

- 422 with the documented `{ error: { code, message, details } }` envelope and
  correct per-field messages, on all four endpoints.
- `/api/auth/verify-email` with no token → 307 to `/verify-email?status=invalid`.
- All four page states render 200 with the right heading.
- **DB unreachable → generic `INTERNAL_SERVER_ERROR` 500 with no trace of
  Prisma, Postgres, the host, the port, or table names**, while the server log
  retains the real cause (`Can't reach database server at localhost:5432`).

### Tokens are stored hashed

`docs/security.md:36,41` requires it, and the existing schema already supports it
with no migration: the raw token goes in the email, its SHA-256 hash goes in the
`token` column, and lookup is by hash. A leaked database backup therefore does
not yield working reset links.

SHA-256 rather than bcrypt is deliberate — these are 32 bytes of CSPRNG output,
so there is no dictionary to attack and a slow KDF buys nothing while making
every verification click slower. Lookup-by-hash is an indexed equality match
inside Postgres, so no secret is compared in application code and there is no
timing channel to close.

### Enumeration resistance

Registration resolves identically whether or not the address exists. A
distinguishable "email already registered" response would let anyone test which
addresses hold accounts at a dental clinic — medical-adjacent information. An
existing *unverified* address gets its verification email re-sent, since that is
almost always someone who lost the first one.

### The same import-time crash, twice more

`lib/email.ts` built `new Resend(process.env.RESEND_API_KEY)` at module scope,
which throws on a missing key. It was harmless only because nothing imported it.
The moment a route handler did, `next build` failed at page-data collection:

```
Error: Missing API key. Pass it to the constructor `new Resend("re_123")`
```

Identical in shape to the Upstash bug fixed in Phase 1. Both are now lazy, and
`lib/whatsapp.ts` was fixed pre-emptively — it has the same module-scope
`twilio()` call and would have failed the same way in Phase 6.

With no `RESEND_API_KEY`, non-production sends log the message (including the
verification link) to the console instead, so the flow is testable without a
Resend account. In production a missing key throws: silently dropping a password
reset is worse than a failed request.

### Deviations worth knowing

1. **Password minimum raised 8 → 10**, per `security.md:32`. UI copy updated in
   both places. Note the seed's `Admin123!` is 9 characters — it still works
   (seeds bcrypt directly, bypassing Zod) but that admin could not *reset* to the
   same password. Worth changing in `prisma/seed.ts` before launch.
2. **zxcvbn score ≥ 3 not implemented.** `security.md:34` asks for it, but
   `zxcvbn` is not a dependency and adding one is a call for you, not me. The
   length/letter/number rules are enforced. Flagging as an open item.
3. **Reset-token TTL corrected to 30 minutes.** `security.md:36` says 30 min;
   `lib/email.ts` copy said "1 hour". The doc wins; the copy was updated.
4. **A completed password reset also sets `emailVerified = true`.** Completing
   one proves mailbox control. Without this, a user who registered but never
   clicked verify would reset successfully and *still* be locked out, because
   `lib/auth.ts` refuses unverified logins.

### End-to-end gate: passed against Supabase

Walked the full flow with `curl` against a live database:

| # | Step | Result |
|---|---|---|
| 1 | `POST /api/auth/register` | 201 |
| 2 | Row written | `role=PATIENT`, `emailVerified=false`, bcrypt cost 12 ✅ |
| 3 | Stored token vs. emailed token | **stored ≠ raw**, **stored = sha256(raw)** ✅ |
| 4 | Login *before* verifying | refused ✅ |
| 5 | Click verify link | 307 → `?status=verified`; token row deleted |
| 6 | Click the same link again | 307 → `?status=invalid` ✅ single-use |
| 7 | Login after verifying | session carries `role`, `firstName`, `isEmailVerified` ✅ |
| 8 | `/dashboard`, `/book` | 200 |
| 9 | `/admin` as PATIENT | 307 → `/dashboard` ✅ |
| 10 | forgot-password, known vs unknown address | **byte-identical 200** ✅ |
| 11 | Reset, then replay the same token | 200, then 422 "already been used" ✅ |
| 12 | Login with old password | refused; new password works ✅ |
| 13 | Seeded `admin@demo.com` | `ADMIN`, `/admin` → 200 ✅ |

The e2e user was deleted afterwards; the database is back to seed state.

The `RESEND_API_KEY` is still unset — the verification link came from the
dev-console fallback added in this phase, which is exactly what it is for.

---

## Phase 3 — Slot engine rewrite (2.5 days)

Pure functions only. No DB calls inside the generator — that is what makes it
testable, and `docs/booking-flow.md` is emphatic about it.

1. **Rewrite `lib/slots.ts`** to the spec signature: `GenerateSlotsInput → Slot[]`.
   Use `date-fns-tz` exclusively; `toLocaleString` is explicitly banned by the doc.
2. **Implement the 5-step algorithm:** blocked-date check → resolve day-of-week in
   clinic tz → build UTC working window → enumerate on the 15-min grid → filter
   overlaps with strict inequalities (`s < a.end && e > a.start`, so back-to-back
   bookings are legal).
3. **DST, both directions.** Spring-forward: drop slots whose local time does not
   round-trip through `utcToZonedTime`. Fall-back: dedupe on the ISO UTC string
   via a `Set`.
4. **`lib/availability.ts` — new.** The DB-touching wrapper: fetch availability,
   blocked dates, and existing PENDING/CONFIRMED appointments, then hand off to
   the pure generator. This is the seam between I/O and logic.
5. **Replace `tests/unit/slots.test.ts`** with the four suites the doc names:
   `slots.basic`, `slots.overlap`, `slots.dst`, `slots.duration`.

**Gate:** all four suites green, with the DST cases explicitly asserted at 02:00
Sydney in both directions.

---

## Phase 4 — Appointment domain (3.5 days)

```
lib/appointments/
  create.ts       three-layer race prevention + "no preference" load balancing
  transition.ts   the state machine — the ONLY code path that writes `status`
  queries.ts      list / get, always scoped by patientId
  reschedule.ts   cancel + rebook inside one transaction
```

### The three defense layers (`create.ts`)

1. **Optimistic re-check** — re-run `getAvailableSlots`; if the chosen slot is
   gone, throw `SlotNoLongerAvailableError` and send the patient back to step 3.
   Cheap, catches the common case, guarantees nothing.
2. **Serializable transaction** — `$transaction(..., { isolationLevel: 'Serializable' })`
   containing the overlap query and the create. Catch Postgres serialization
   failures, **retry once**, then surface `ConflictError`.
3. **The partial unique index** — already in place from Phase 0. Catches exact
   start-time collisions only; overlap-only conflicts are Layer 2's job.

### Also in this phase

- Add `rescheduledFromId String?` to `schema.prisma` (+ migration). The reschedule
  spec requires it; it is currently missing.
- `transition.ts` enforces the full state machine table from `booking-flow.md`.
  Route handlers and server actions **never** set `status` directly.
- The 24h rule, exactly as specified — no fuzz factor. 23h59m is a rejection.
- "No preference" resolution: pick the dentist with the fewest appointments that
  day; break ties by dentist ID for determinism.

**Gate:** `booking.race.test.ts` fires two concurrent transactions at one slot.
Exactly one wins; the other gets `ConflictError`. This is the single most
important test in the codebase.

---

## Phase 5 — Server actions + route handlers (4 days)

Only now do the stubs get filled. Per `api-conventions.md`: **mutations are Server
Actions; route handlers are only for cron, file downloads, webhooks, and external
callers.**

### Server actions — `lib/actions/`

`appointments.ts` (book / cancel / reschedule), `profile.ts`,
`admin/appointments.ts`, `admin/dentists.ts`, `admin/services.ts`,
`admin/availability.ts`.

Actions return plain objects and never throw raw errors to the client.

### Route handlers — replace all 10 stubs

| Route | Notes |
|---|---|
| `/api/availability` | GET — calls Phase 3 |
| `/api/services`, `/api/dentists` | GET, public, active only |
| `/api/appointments` | GET own + `PATCH /:id`. **Filter by `session.user.id`, never by the URL param** — this is the IDOR rule from `CLAUDE.md` |
| `/api/admin/appointments`, `/dentists`, `/patients` | `requireRole('ADMIN','DENTIST')` **in the handler**, not just middleware. DENTIST scoped to their own appointments |
| `/api/admin/export` | GET → `lib/export.ts`, which is already written and needs only wiring |

**Missing routes to add** (in `api-conventions.md`, absent from the tree):
`/api/admin/services`, `/api/admin/availability`, `/api/admin/blocked-dates`,
`/api/patient/profile`.

### Unwire the mocks

Delete every `MOCK_*` constant and every `await new Promise(r => setTimeout(...))`
fake mutation, then wire the real data through:

- `app/(patient)/dashboard/page.tsx:21`
- `app/(patient)/appointments/page.tsx:12`
- `app/(admin)/admin/page.tsx:11` (hardcoded "247 patients")
- `components/booking/booking-form.tsx:25,34,41`
- `components/admin/{appointments-table,patients-table,dentists-manager,services-manager,export-form}.tsx`
- `components/booking/cancel-appointment-button.tsx:23`
- `components/shared/profile-form.tsx:49,57`

Fix `dentistId` nullability here so the "No preference" path actually works.

**Gate:** book a real appointment as a patient; see the row in `db:studio`; see it
on the patient dashboard and in the admin table; cancel it and confirm the slot
becomes bookable again (this is the Phase 0 index fix paying off).

---

## Phase 6 — Cron, reminders, deploy (2 days)

1. **`app/api/cron/reminders/route.ts`** — note the path. The stub is at
   `/api/cron`; the spec says `/api/cron/reminders`. Verify
   `Authorization: Bearer ${CRON_SECRET}` **before touching the database**.
2. **`vercel.json` — new.** Without it the cron never fires, no matter how correct
   the endpoint is. Hourly schedule.
3. **Reminder logic:** the 23–25h window query; WhatsApp then email; flip
   `reminderSent = true` in the same transaction as the read. Set it **even when
   both providers fail** — `booking-flow.md` is deliberate here: a late reminder is
   worse than none. Sentry alerts, ops calls the patient.
4. **Sentry:** `sentry.client.config.ts`, `sentry.server.config.ts`,
   `sentry.edge.config.ts`. The package is installed and has never been imported.
5. **`tests/e2e/book.spec.ts`** — the three Playwright scenarios the doc names.
6. **`README.md`** — still untouched `create-next-app` boilerplate.

**Gate:** curl the cron endpoint with and without the secret. Confirm exactly one
send, and no double-send when re-run within the same hour.

---

## Timeline

| Phase | Effort | Status |
|---|---|---|
| 0 — Runnable | 0.5d | ✅ done |
| 1 — Foundation | 1d | ✅ done |
| 2 — Auth | 1.5d | ✅ done, e2e verified |
| 3 — Slot engine | 2.5d | |
| 4 — Domain | 3.5d | |
| 5 — Actions + handlers | 4d | |
| 6 — Cron + deploy | 2d | |
| **Total** | **~15 working days (3 weeks)** | |

**Critical path:** 0 → 1 → 3 → 4 → 5. Phase 2 blocks manual testing but not
compilation, so with two people Phases 2 and 3 run in parallel and the whole thing
lands in ~11 days.

---

## Definition of done, per phase

Every phase ends with `pnpm typecheck && pnpm lint && pnpm test` green — that is
the `CLAUDE.md` rule and Phase 0 has established the baseline, so any breakage
from here is newly introduced and attributable.

Additionally, per the security checklist, each phase's PR confirms:

- [ ] All inputs validated with Zod at the boundary
- [ ] All queries scoped to the current user where applicable (no IDOR)
- [ ] Role checks in the handler, not just middleware
- [ ] Rate limiting on auth + booking endpoints
- [ ] No secrets in the client bundle
- [ ] Cron endpoints check `CRON_SECRET`
- [ ] Loading / empty / error states for any new UI surface

---

## Open questions — need a human call

These change Phase 4's shape, so they are worth answering before it starts.

1. **Reschedule in MVP, or defer?** It needs a schema column and a nested
   transaction. Cutting it saves ~1 day, and the UI has no reschedule button today.
2. **Do dentists get write access?** `booking-flow.md` says they may confirm and
   complete their own appointments, but its closing section defers
   dentist-initiated booking to post-launch. Current assumption: implement the
   former, not the latter.
3. **`date` vs `appointmentDate` in the validator.** The docs and the code
   disagree. Assumption: keep `appointmentDate` (matches the Prisma column) and
   correct the doc.
4. **AI chat booking** — discussed separately, not in this plan. It should come
   *after* Phase 5, since its tools would wrap exactly the endpoints being built
   here. Building it sooner means a conversational interface to mock data.
